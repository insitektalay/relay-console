#!/usr/bin/env python3
"""Generate Relay's pinned ShareFile operation registry from official API docs."""

from __future__ import annotations

import hashlib
import html
import re
import urllib.request
from pathlib import Path


RESOURCES = [
    "AccessControls", "Accounts", "Apps", "AsyncOperations", "Capabilities",
    "ConnectorGroups", "Devices", "EncryptedEmails", "FavoriteFolders",
    "Favorites", "FolderTemplates", "Groups", "Items", "Metadata", "Policies",
    "Reports", "Sessions", "Shares", "StorageCenters", "Users", "WebhookClients",
    "WebhookSubscriptions", "Workflows", "Zones",
]
ADMIN_RESOURCES = {
    "AccessControls", "Accounts", "Apps", "Capabilities", "ConnectorGroups",
    "Devices", "FolderTemplates", "Groups", "Metadata", "Policies", "Reports",
    "StorageCenters", "Users", "WebhookClients", "WebhookSubscriptions", "Zones",
}
BASE = "https://api.sharefile.com/html/docs/{resource}.html"
OUTPUT = Path(__file__).resolve().parents[1] / "src/modules/marketplace/connectors/sharefile/sharefile-operation-registry.ts"


def text(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", value))).strip()


def ts_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def operation_id(resource: str, method: str, title: str, path: str) -> str:
    stem = re.sub(r"[^a-zA-Z0-9]+", " ", f"{method} {resource} {title}").title().replace(" ", "")
    stem = stem[0].lower() + stem[1:]
    return f"{stem}_{hashlib.sha256(path.encode()).hexdigest()[:8]}"


def main() -> None:
    operations: list[dict[str, object]] = []
    evidence = hashlib.sha256()
    for resource in RESOURCES:
        url = BASE.format(resource=resource)
        with urllib.request.urlopen(url, timeout=30) as response:
            document = response.read().decode("utf-8")
        evidence.update(resource.encode())
        evidence.update(document.encode())
        blocks = re.findall(r'<div class="method-block panel".*?<h3>(.*?)</h3>.*?<pre><code>(.*?)</code></pre>', document, re.S)
        for raw_title, raw_code in blocks:
            title = text(raw_title)
            code = text(raw_code)
            match = re.match(r"(GET|POST|PUT|PATCH|DELETE)\s+https://account\.sf-api\.com(/sf/v3/[^ ]*)", code)
            if not match:
                continue
            method, raw_target = match.groups()
            raw_path, _, raw_query = raw_target.partition("?")
            path_parameters: list[str] = []

            def replace_group(group_match: re.Match[str]) -> str:
                parts = []
                for part in group_match.group(1).split(","):
                    name = part.split("=", 1)[0].strip()
                    if re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", name):
                        if name not in path_parameters:
                            path_parameters.append(name)
                        parts.append("{" + name + "}")
                    else:
                        parts.append(part)
                return "(" + ",".join(parts) + ")"

            path = re.sub(r"\(([^)]+)\)", replace_group, raw_path)
            query_parameters = []
            for part in raw_query.split("&") if raw_query else []:
                name = part.split("=", 1)[0]
                if name and name not in query_parameters:
                    query_parameters.append(name)
            body_mode = "json" if method != "GET" and ("{" in code or "[" in code) else "none"
            group = "read" if method == "GET" else ("admin" if resource in ADMIN_RESOURCES else "content_write")
            operations.append({
                "id": operation_id(resource, method, title, f"{path}?{raw_query}"),
                "summary": title,
                "method": method,
                "path": path,
                "resource": resource,
                "pathParameters": path_parameters,
                "queryParameters": query_parameters,
                "bodyMode": body_mode,
                "responseMode": "json",
                "group": group,
            })

    seen: set[str] = set()
    unique = []
    for operation in operations:
        key = f"{operation['method']} {operation['path']}?{','.join(operation['queryParameters'])}"
        if key not in seen:
            seen.add(key)
            unique.append(operation)
    operations = sorted(unique, key=lambda item: str(item["id"]))

    lines = [
        "// Generated from ShareFile's official REST API entity documentation.",
        f"// Source corpus SHA-256: {evidence.hexdigest()}",
        "// Evidence date: 2026-07-14. Duplicate route variants are intentionally collapsed.",
        "",
        "export type ShareFileOperation = {",
        "  id: string;",
        "  summary: string;",
        '  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";',
        "  path: string;",
        "  resource: string;",
        "  pathParameters: readonly string[];",
        "  queryParameters: readonly string[];",
        '  bodyMode: "none" | "json";',
        '  responseMode: "json";',
        '  group: "read" | "content_write" | "admin";',
        "};",
        "",
        "export const SHAREFILE_OPERATIONS = [",
    ]
    for operation in operations:
        lines.extend([
            "  {",
            f'    id: "{ts_string(str(operation["id"]))}",',
            f'    summary: "{ts_string(str(operation["summary"]))}",',
            f'    method: "{operation["method"]}",',
            f'    path: "{ts_string(str(operation["path"]))}",',
            f'    resource: "{operation["resource"]}",',
            f'    pathParameters: {operation["pathParameters"]!r},'.replace("'", '"'),
            f'    queryParameters: {operation["queryParameters"]!r},'.replace("'", '"'),
            f'    bodyMode: "{operation["bodyMode"]}",',
            '    responseMode: "json",',
            f'    group: "{operation["group"]}",',
            "  },",
        ])
    lines.extend([
        "] as const satisfies readonly ShareFileOperation[];",
        "",
        "export const SHAREFILE_OPERATION_BY_ID = new Map<string, ShareFileOperation>(SHAREFILE_OPERATIONS.map((operation) => [operation.id, operation]));",
        'export const SHAREFILE_READ_OPERATION_IDS = SHAREFILE_OPERATIONS.filter((operation) => operation.group === "read").map((operation) => operation.id);',
        'export const SHAREFILE_CONTENT_WRITE_OPERATION_IDS = SHAREFILE_OPERATIONS.filter((operation) => operation.group === "content_write").map((operation) => operation.id);',
        'export const SHAREFILE_ADMIN_OPERATION_IDS = SHAREFILE_OPERATIONS.filter((operation) => operation.group === "admin").map((operation) => operation.id);',
        "",
    ])
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(lines), encoding="utf-8")
    counts = {group: sum(1 for item in operations if item["group"] == group) for group in ("read", "content_write", "admin")}
    print(f"wrote {len(operations)} ShareFile operations to {OUTPUT} ({counts})")


if __name__ == "__main__":
    main()
