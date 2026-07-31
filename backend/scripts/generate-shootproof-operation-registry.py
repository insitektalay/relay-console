#!/usr/bin/env python3
"""Generate Relay's pinned ShootProof operation registry from official OpenAPI."""

from __future__ import annotations

import hashlib
import json
import re
import urllib.request
from pathlib import Path


SOURCE = "https://developer.shootproof.com/oas/studio.json"
OUTPUT = Path(__file__).resolve().parents[1] / "src/modules/marketplace/connectors/shootproof/shootproof-operation-registry.ts"
METHODS = ("get", "post", "put", "patch", "delete")


def ts(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def main() -> None:
    with urllib.request.urlopen(SOURCE, timeout=30) as response:
        raw = response.read()
    document = json.loads(raw)
    operations: list[dict[str, object]] = []
    used: set[str] = set()
    for path, path_item in document["paths"].items():
        for method in METHODS:
            operation = path_item.get(method)
            if not operation:
                continue
            operation_id = operation.get("operationId") or re.sub(
                r"[^A-Za-z0-9]+", " ", f"{method} {path}"
            ).title().replace(" ", "")
            operation_id = operation_id[0].lower() + operation_id[1:]
            if operation_id in used:
                operation_id += hashlib.sha256(f"{method}:{path}".encode()).hexdigest()[:8]
            used.add(operation_id)
            parameters = [*path_item.get("parameters", []), *operation.get("parameters", [])]
            query = [
                parameter["name"]
                for parameter in parameters
                if parameter.get("in") == "query" and "name" in parameter
            ]
            operations.append(
                {
                    "id": operation_id,
                    "method": method.upper(),
                    "path": path,
                    "summary": re.sub(r"\s+", " ", operation.get("summary", operation_id)).strip(),
                    "pathParameters": re.findall(r"\{([A-Za-z0-9_]+)\}", path),
                    "queryParameters": list(dict.fromkeys(query)),
                    "bodyAllowed": bool(operation.get("requestBody")),
                }
            )
    operations.sort(key=lambda item: str(item["id"]))
    lines = [
        "// Generated from ShootProof's official Studio API OpenAPI 3.0 document.",
        f"// Source: {SOURCE}",
        f"// SHA-256: {hashlib.sha256(raw).hexdigest()}",
        "// Evidence date: 2026-07-17.",
        "",
        "export type ShootProofOperation = {",
        "  id: string;",
        '  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";',
        "  path: string;",
        "  summary: string;",
        "  pathParameters: readonly string[];",
        "  queryParameters: readonly string[];",
        "  bodyAllowed: boolean;",
        "};",
        "",
        f'export const SHOOTPROOF_SOURCE_SHA256 = "{hashlib.sha256(raw).hexdigest()}";',
        "",
        "export const SHOOTPROOF_OPERATIONS = [",
    ]
    for item in operations:
        lines.extend(
            [
                "  {",
                f"    id: {ts(str(item['id']))},",
                f"    method: {ts(str(item['method']))},",
                f"    path: {ts(str(item['path']))},",
                f"    summary: {ts(str(item['summary']))},",
                f"    pathParameters: {json.dumps(item['pathParameters'])},",
                f"    queryParameters: {json.dumps(item['queryParameters'])},",
                f"    bodyAllowed: {str(item['bodyAllowed']).lower()},",
                "  },",
            ]
        )
    lines.extend(
        [
            "] as const satisfies readonly ShootProofOperation[];",
            "",
            "export const SHOOTPROOF_OPERATION_BY_ID = new Map<string, ShootProofOperation>(SHOOTPROOF_OPERATIONS.map((operation) => [operation.id, operation]));",
            'export const SHOOTPROOF_READ_OPERATION_IDS = SHOOTPROOF_OPERATIONS.filter((operation) => operation.method === "GET").map((operation) => operation.id);',
            'export const SHOOTPROOF_MANAGE_OPERATION_IDS = SHOOTPROOF_OPERATIONS.filter((operation) => operation.method !== "GET").map((operation) => operation.id);',
            "",
        ]
    )
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"wrote {len(operations)} ShootProof operations to {OUTPUT}")


if __name__ == "__main__":
    main()
