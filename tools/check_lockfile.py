#!/usr/bin/env python3
"""Check web/package-lock.json is self-consistent the way `npm ci` does.

`npm ci` fails with "Missing: X from lock file" when a recorded dependency has
no entry reachable by node_modules resolution. On 2026-08-13 that turned six
consecutive pushes red: removing six unused dependencies with
`npm install --package-lock-only` **on macOS** pruned three top-level
`@emnapi/*` entries, which are the peer dependencies of
`@napi-rs/wasm-runtime` — reachable only through
`@rolldown/binding-wasm32-wasi`, an optional binding macOS never installs.
The lock looked fine locally and `npm ci` worked here; it could not work on the
Linux runner.

Every check available locally missed it. `npm ci --dry-run` on macOS is
explicitly not a gate for a Linux `npm ci`, and a build that succeeds proves
only that the current platform's tree resolves. This walks every dependency
edge in the lock instead, which is platform-independent and catches the whole
class in about a tenth of a second, with no network and no install.

    python3 tools/check_lockfile.py
"""
import json
import pathlib
import sys

LOCK = pathlib.Path(__file__).resolve().parent.parent / "web/package-lock.json"
pkgs = json.loads(LOCK.read_text())["packages"]


def resolve(from_path: str, name: str) -> str | None:
    """Walk node_modules the way Node does: nearest enclosing scope first."""
    parts = from_path.split("node_modules/")
    while parts:
        prefix = "node_modules/".join(parts)
        prefix = prefix if prefix.endswith("/") or prefix == "" else prefix + "/"
        cand = f"{prefix}node_modules/{name}"
        if cand in pkgs:
            return cand
        parts.pop()
    return f"node_modules/{name}" if f"node_modules/{name}" in pkgs else None


missing = []
for path, meta in pkgs.items():
    for field in ("dependencies", "optionalDependencies", "peerDependencies"):
        for dep, spec in (meta.get(field) or {}).items():
            if field == "peerDependencies" and (meta.get("peerDependenciesMeta", {}).get(dep, {}).get("optional")):
                continue
            if resolve(path, dep) is None:
                missing.append((path or "<root>", field, dep, spec))

if missing:
    print(f"{len(missing)} unresolvable dependency edge(s):", file=sys.stderr)
    for path, field, dep, spec in missing[:30]:
        print(f"  {path} [{field}] -> {dep}@{spec}", file=sys.stderr)
    sys.exit(1)
print(f"lock is self-consistent: {len(pkgs)} packages, every dependency edge resolves")
