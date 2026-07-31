#!/usr/bin/env python3
"""Build and verify the frozen Marketplace icon atlas shared by every client."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import shutil
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[1]
RELEASE_MANIFEST = ROOT / "packages/marketplace-catalog/release/marketplace-release-manifest.json"
PROVIDER_CATALOG = ROOT / "backend/src/modules/marketplace/catalog/generated-provider-catalog.json"
CANONICAL_ATLAS = ROOT / "packages/marketplace-catalog/release/marketplace-icon-atlas.png"
CANONICAL_INDEX = ROOT / "packages/marketplace-catalog/release/marketplace-icon-atlas-index.json"

WEB_ATLAS = ROOT / "web/public/marketplace/marketplace-icon-atlas.png"
WEB_INDEX = ROOT / "web/lib/marketplace-icon-atlas-index.json"
MAC_ATLAS = ROOT / "RelayConsoleSwift/Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-icon-atlas.png"
MAC_INDEX = ROOT / "RelayConsoleSwift/Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-icon-atlas-index.json"
IOS_IMAGESET = ROOT / "ios/ClawChat/Assets.xcassets/MarketplaceIconAtlas.imageset"
IOS_DATASET = ROOT / "ios/ClawChat/Assets.xcassets/MarketplaceIconAtlasIndex.dataset"
IOS_ATLAS = IOS_IMAGESET / "marketplace-icon-atlas.png"
IOS_INDEX = IOS_DATASET / "marketplace-icon-atlas-index.json"

TILE_SIZE = 128
COLUMNS = 21
USER_AGENT = "Relay-Console-Marketplace-Icon-Freezer/1.0"

MANUAL_SOURCES = {
    "action-network": "https://s40484.pcdn.co/wp-content/uploads/2022/04/cropped-Favicon@2x-300x300.png",
    "amazing-marvin": "https://amazingmarvin.com/images/Marvin_circle.png",
    "frontify": "https://cdn.prod.website-files.com/66e0711541e49a7979011342/67cac2d33dabe44b10910510_web-app-manifest-256x256.png",
    "yodlee-fastlink": "https://snapshotcmt.yodlee.com/favicon.ico",
}


@dataclass(frozen=True)
class Provider:
    slug: str
    name: str
    website_url: str


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def providers() -> tuple[str, list[Provider]]:
    release = load_json(RELEASE_MANIFEST)
    catalog = load_json(PROVIDER_CATALOG)
    manifests = {entry["slug"]: entry for entry in catalog["manifests"]}
    slugs = sorted(
        entry["slug"] for entry in release["providers"] if entry.get("connectEligible") is True
    )
    result: list[Provider] = []
    for slug in slugs:
        manifest = manifests.get(slug)
        if manifest is None:
            raise RuntimeError(f"Launch provider {slug!r} is absent from the generated provider catalog")
        website_url = manifest.get("provider", {}).get("websiteUrl")
        if not website_url:
            raise RuntimeError(f"Launch provider {slug!r} has no provider website URL")
        result.append(Provider(slug=slug, name=manifest["name"], website_url=website_url))
    if len(result) != 406:
        raise RuntimeError(f"Expected exactly 406 launch providers, found {len(result)}")
    return release["manifestVersion"], result


def icon_sources(provider: Provider) -> list[tuple[str, str]]:
    if provider.slug in MANUAL_SOURCES:
        return [("official_override", MANUAL_SOURCES[provider.slug])]
    encoded = quote(provider.website_url, safe="")
    parsed = urlsplit(provider.website_url)
    origin_favicon = f"{parsed.scheme}://{parsed.netloc}/favicon.ico"
    return [
        ("google_favicon_snapshot", f"https://www.google.com/s2/favicons?domain_url={encoded}&sz=128"),
        ("official_origin_favicon", origin_favicon),
    ]


def fetch_icon(provider: Provider) -> tuple[Provider, str, str, bytes, Image.Image, tuple[int, int]]:
    last_error: Exception | None = None
    attempted_urls = []
    for source_kind, source_url in icon_sources(provider):
        attempted_urls.append(source_url)
        for attempt in range(3):
            try:
                request = Request(source_url, headers={"User-Agent": USER_AGENT, "Accept": "image/*"})
                with urlopen(request, timeout=25) as response:
                    data = response.read()
                if not data:
                    raise RuntimeError("empty response")
                if data.startswith(b"\x1f\x8b"):
                    data = gzip.decompress(data)
                image = Image.open(BytesIO(data))
                image.load()
                original_size = image.size
                return provider, source_kind, source_url, data, image.convert("RGBA"), original_size
            except Exception as exc:  # pragma: no cover - exercised only by remote failures
                last_error = exc
                if attempt < 2:
                    time.sleep(0.4 * (attempt + 1))
    raise RuntimeError(f"{provider.slug}: {', '.join(attempted_urls)}: {last_error}")


def normalized_tile(image: Image.Image) -> tuple[Image.Image, bool]:
    tile = Image.new("RGBA", (TILE_SIZE, TILE_SIZE), (255, 255, 255, 0))
    visible_pixels = [pixel for pixel in image.getdata() if pixel[3] >= 32]
    white_mark = bool(visible_pixels) and (
        sum(1 for red, green, blue, _ in visible_pixels if red >= 228 and green >= 228 and blue >= 228)
        / len(visible_pixels)
        >= 0.7
    )
    if white_mark:
        ImageDraw.Draw(tile).rounded_rectangle((8, 8, 120, 120), radius=20, fill=(24, 31, 48, 255))
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise RuntimeError("downloaded icon has no visible pixels")
    image = image.crop(bounds)
    fitted = ImageOps.contain(image, (104, 104), Image.Resampling.LANCZOS)
    x = (TILE_SIZE - fitted.width) // 2
    y = (TILE_SIZE - fitted.height) // 2
    tile.alpha_composite(fitted, (x, y))
    return tile, white_mark


def write_ios_metadata() -> None:
    IOS_IMAGESET.mkdir(parents=True, exist_ok=True)
    IOS_DATASET.mkdir(parents=True, exist_ok=True)
    (IOS_IMAGESET / "Contents.json").write_text(
        json.dumps(
            {
                "images": [
                    {
                        "filename": IOS_ATLAS.name,
                        "idiom": "universal",
                        "scale": "1x",
                    }
                ],
                "info": {"author": "xcode", "version": 1},
                "properties": {"preserves-vector-representation": False},
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    (IOS_DATASET / "Contents.json").write_text(
        json.dumps(
            {
                "data": [
                    {
                        "filename": IOS_INDEX.name,
                        "idiom": "universal",
                        "universal-type-identifier": "public.json",
                    }
                ],
                "info": {"author": "xcode", "version": 1},
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def sync() -> None:
    if not CANONICAL_ATLAS.exists() or not CANONICAL_INDEX.exists():
        raise RuntimeError("Canonical Marketplace icon atlas is missing; run with --build first")
    for target in (WEB_ATLAS, MAC_ATLAS, IOS_ATLAS):
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(CANONICAL_ATLAS, target)
    for target in (WEB_INDEX, MAC_INDEX, IOS_INDEX):
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(CANONICAL_INDEX, target)
    write_ios_metadata()


def build() -> None:
    manifest_version, cohort = providers()
    fetched = {}
    failures = []
    with ThreadPoolExecutor(max_workers=24) as executor:
        futures = {executor.submit(fetch_icon, provider): provider.slug for provider in cohort}
        for future in as_completed(futures):
            slug = futures[future]
            try:
                fetched[slug] = future.result()
            except Exception as exc:
                failures.append(str(exc))
    if failures:
        raise RuntimeError("Marketplace icon download failed:\n" + "\n".join(sorted(failures)))

    rows = (len(cohort) + COLUMNS - 1) // COLUMNS
    atlas = Image.new("RGBA", (COLUMNS * TILE_SIZE, rows * TILE_SIZE), (255, 255, 255, 0))
    entries = {}
    for index, provider in enumerate(cohort):
        _, source_kind, source_url, source_data, image, original_size = fetched[provider.slug]
        column = index % COLUMNS
        row = index // COLUMNS
        tile, dark_background_applied = normalized_tile(image)
        atlas.alpha_composite(tile, (column * TILE_SIZE, row * TILE_SIZE))
        entries[provider.slug] = {
            "index": index,
            "column": column,
            "row": row,
            "name": provider.name,
            "sourceKind": source_kind,
            "sourceUrl": source_url,
            "sourceSHA256": sha256_bytes(source_data),
            "sourceWidth": original_size[0],
            "sourceHeight": original_size[1],
            "darkBackgroundApplied": dark_background_applied,
        }

    CANONICAL_ATLAS.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(CANONICAL_ATLAS, format="PNG", optimize=True)
    atlas_data = CANONICAL_ATLAS.read_bytes()
    index_document = {
        "schemaVersion": "relay.marketplace-icon-atlas.v1",
        "cohortManifestVersion": manifest_version,
        "appCount": len(cohort),
        "tileSize": TILE_SIZE,
        "columns": COLUMNS,
        "rows": rows,
        "atlasWidth": atlas.width,
        "atlasHeight": atlas.height,
        "atlasSHA256": sha256_bytes(atlas_data),
        "apps": entries,
    }
    CANONICAL_INDEX.write_text(
        json.dumps(index_document, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    sync()


def check() -> None:
    manifest_version, cohort = providers()
    index = load_json(CANONICAL_INDEX)
    expected_slugs = [provider.slug for provider in cohort]
    actual_slugs = sorted(index.get("apps", {}).keys())
    errors = []
    if index.get("schemaVersion") != "relay.marketplace-icon-atlas.v1":
        errors.append("unexpected atlas schema version")
    if index.get("cohortManifestVersion") != manifest_version:
        errors.append("atlas cohort manifest version is stale")
    if index.get("appCount") != 406 or actual_slugs != expected_slugs:
        errors.append("atlas does not contain the exact 406-app launch cohort")
    if not CANONICAL_ATLAS.exists():
        errors.append("canonical atlas PNG is missing")
    else:
        data = CANONICAL_ATLAS.read_bytes()
        if sha256_bytes(data) != index.get("atlasSHA256"):
            errors.append("canonical atlas SHA-256 does not match its index")
        with Image.open(BytesIO(data)) as image:
            expected_size = (index.get("atlasWidth"), index.get("atlasHeight"))
            if image.size != expected_size:
                errors.append(f"canonical atlas dimensions {image.size} do not match {expected_size}")
            rgba = image.convert("RGBA")
            for slug, entry in index.get("apps", {}).items():
                left = entry["column"] * TILE_SIZE
                top = entry["row"] * TILE_SIZE
                tile = rgba.crop((left, top, left + TILE_SIZE, top + TILE_SIZE))
                if tile.getchannel("A").getbbox() is None:
                    errors.append(f"atlas tile has no visible pixels: {slug}")
    for target in (WEB_ATLAS, MAC_ATLAS, IOS_ATLAS):
        if not target.exists() or target.read_bytes() != CANONICAL_ATLAS.read_bytes():
            errors.append(f"atlas copy is missing or stale: {target.relative_to(ROOT)}")
    for target in (WEB_INDEX, MAC_INDEX, IOS_INDEX):
        if not target.exists() or target.read_bytes() != CANONICAL_INDEX.read_bytes():
            errors.append(f"atlas index copy is missing or stale: {target.relative_to(ROOT)}")
    if errors:
        raise RuntimeError("Marketplace icon atlas check failed:\n- " + "\n- ".join(errors))
    print(
        f"Marketplace icon atlas verified: {index['appCount']} local icons, "
        f"{index['columns']}x{index['rows']} tiles, SHA-256 {index['atlasSHA256']}."
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--build", action="store_true", help="Download and freeze all launch icons")
    mode.add_argument("--sync", action="store_true", help="Sync the frozen atlas into every client")
    mode.add_argument("--check", action="store_true", help="Verify completeness and client parity")
    args = parser.parse_args()
    try:
        if args.build:
            build()
        elif args.sync:
            sync()
        check()
        return 0
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
