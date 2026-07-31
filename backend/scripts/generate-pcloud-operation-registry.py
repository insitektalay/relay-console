#!/usr/bin/env python3
"""Generate Relay's pinned pCloud operation registry from official docs."""

from __future__ import annotations

import hashlib
import html
import json
import re
import urllib.request
from pathlib import Path

DOCS = "https://docs.pcloud.com"
INDEX = f"{DOCS}/methods/"
OUTPUT = Path(__file__).resolve().parents[1] / "src/modules/marketplace/connectors/pcloud/pcloud-operation-registry.ts"
EXCLUDED_CATEGORIES = {"auth", "newsletter", "oauth_2.0"}
EXCLUDED_METHODS = {"getdigest"}
READS = {
    "userinfo", "supportedlanguages", "currentserver", "diff", "getfilehistory", "getip", "getapiserver",
    "listfolder", "uploadprogress", "checksumfile", "stat",
    "getfilelink", "getvideolink", "getvideolinks", "getaudiolink", "gethlslink", "gettextfile",
    "getzip", "getziplink", "extractarchiveprogress", "savezipprogress",
    "listshares", "sharerequestinfo", "showpublink", "getpublinkdownload", "listpublinks", "listplshort",
    "getpubthumb", "getpubthumblink", "getpubthumbslinks", "getpubzip", "getpubziplink",
    "getpubvideolinks", "getpubaudiolink", "getpubtextfile", "getcollectionpublink",
    "getthumblink", "getthumbslinks", "getthumb", "listuploadlinks", "showuploadlink", "uploadlinkprogress",
    "listrevisions", "trash_list", "collection_list", "collection_details", "uploadtransferprogress",
}
BINARY_DOWNLOADS = {"downloadfile", "getzip", "getpubthumb", "getpubzip", "getthumb", "gettextfile", "getpubtextfile"}
UPLOADS = {"uploadfile", "uploadtolink", "uploadtransfer"}


def fetch(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "RelayConsole catalog generator"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", "replace")


def text(value: str) -> str:
    value = re.sub(r"<br\s*/?>", " ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    return " ".join(html.unescape(value).split())


def field(page: str, label: str) -> str:
    match = re.search(
        rf"<dt><p>{re.escape(label)}</p></dt><dd><p>(.*?)</p></dd>",
        page,
        flags=re.I | re.S,
    )
    return match.group(1) if match else ""


def main() -> None:
    index = fetch(INDEX)
    links = sorted(set(re.findall(r'href="(/methods/([^/]+)/([^/"]+)\.html)"', index)))
    operations = []
    corpus = hashlib.sha256(index.encode()).hexdigest()
    for path, category, name in links:
        if category in EXCLUDED_CATEGORIES or name in EXCLUDED_METHODS or category == "intro":
            continue
        page = fetch(f"{DOCS}{path}")
        corpus = hashlib.sha256((corpus + hashlib.sha256(page.encode()).hexdigest()).encode()).hexdigest()
        auth = text(field(page, "Auth")).lower()
        if auth not in {"yes", "no"}:
            continue
        parameters = sorted(set(re.findall(r"<strong>([A-Za-z0-9_]+)</strong>", field(page, "Required") + field(page, "Optional"))))
        summary = text(field(page, "Description"))[:500] or name
        operations.append({
            "id": name,
            "summary": summary,
            "category": category,
            "parameters": parameters,
            "requiresAuth": auth == "yes",
            "method": "GET" if name in READS else "POST",
            "responseMode": "binary" if name in BINARY_DOWNLOADS else "json",
            "bodyMode": "multipart" if name in UPLOADS else "form",
            "group": "read" if name in READS else "write",
        })
    operations.sort(key=lambda item: item["id"])
    payload = json.dumps(operations, indent=2, ensure_ascii=False)
    payload = re.sub(r'"(requiresAuth)": (true|false)', r'\1: \2', payload)
    payload = re.sub(r'"([A-Za-z][A-Za-z0-9]*)":', r'\1:', payload)
    header = f'''// Generated from pCloud's official HTTP/JSON method documentation.
// Source corpus SHA-256: {corpus}
// Evidence date: 2026-07-14. Account credential, registration, newsletter, and OAuth broker methods are excluded.

export type PCloudOperation = {{
  id: string;
  summary: string;
  category: string;
  parameters: readonly string[];
  requiresAuth: boolean;
  method: "GET" | "POST";
  responseMode: "json" | "binary";
  bodyMode: "form" | "multipart";
  group: "read" | "write";
}};

export const PCLOUD_OPERATIONS = {payload} as const satisfies readonly PCloudOperation[];

export const PCLOUD_OPERATION_BY_ID = new Map(PCLOUD_OPERATIONS.map((operation) => [operation.id, operation]));
export const PCLOUD_READ_OPERATION_IDS = PCLOUD_OPERATIONS.filter((operation) => operation.group === "read").map((operation) => operation.id);
export const PCLOUD_WRITE_OPERATION_IDS = PCLOUD_OPERATIONS.filter((operation) => operation.group === "write").map((operation) => operation.id);
'''
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(header, encoding="utf-8")
    print(f"generated {len(operations)} pCloud operations ({len([o for o in operations if o['group'] == 'read'])} reads, {len([o for o in operations if o['group'] == 'write'])} writes)")


if __name__ == "__main__":
    main()
