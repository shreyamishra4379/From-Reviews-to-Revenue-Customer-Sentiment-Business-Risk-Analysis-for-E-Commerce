"""
integrity.py — SHA-256 fingerprints of every result the dashboard shows.

After the pipeline and export run, `write_manifest()` records the SHA-256 hash and
size of each processed data file and each dashboard JSON file. `verify_manifest()`
recomputes them: any file that was edited, replaced or deleted after the analysis
shows up as a mismatch. The dashboard runs the same check (dashboard/lib/security/
integrity.ts) and shows the result on its Security page.

A hash proves a file is unchanged since the manifest was written; it does not prove
who wrote it (that would need a signature).

Usage:
    python src/security/integrity.py          # verify (exit 1 on mismatch)
    python src/security/integrity.py --write  # rebuild the manifest
"""
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
MANIFEST = ROOT / "data" / "processed" / "integrity_manifest.json"

# What gets fingerprinted, relative to the project root
COVERED = [
    ("data/processed", ("*.parquet", "*.json", "*.csv")),
    ("data/processed/stage4", ("*.json", "*.csv")),
    ("dashboard/public/data", ("*.json",)),
    ("sql", ("*.sql", "views.json")),
]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def covered_files() -> list[Path]:
    files: set[Path] = set()
    for folder, patterns in COVERED:
        for pattern in patterns:
            files.update((ROOT / folder).glob(pattern))
    files.discard(MANIFEST)
    return sorted(files)


def write_manifest() -> dict:
    entries = {
        p.relative_to(ROOT).as_posix(): {"sha256": sha256_file(p), "bytes": p.stat().st_size}
        for p in covered_files()
    }
    manifest = {
        "algorithm": "SHA-256",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "files": entries,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def verify_manifest() -> dict:
    """Returns {"ok": bool, "checked": n, "modified": [...], "missing": [...], "untracked": [...]}"""
    if not MANIFEST.exists():
        return {"ok": False, "checked": 0, "modified": [], "missing": [], "untracked": [],
                "error": "No manifest. Run: python src/security/integrity.py --write"}
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    recorded = manifest["files"]
    modified, missing = [], []
    for rel, info in recorded.items():
        p = ROOT / rel
        if not p.exists():
            missing.append(rel)
        elif sha256_file(p) != info["sha256"]:
            modified.append(rel)
    present = {p.relative_to(ROOT).as_posix() for p in covered_files()}
    untracked = sorted(present - set(recorded))
    return {"ok": not (modified or missing), "checked": len(recorded), "modified": modified,
            "missing": missing, "untracked": untracked, "generated_at": manifest.get("generated_at")}


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if "--write" in sys.argv:
        m = write_manifest()
        print(f"[INTEGRITY] Fingerprinted {len(m['files'])} files -> {MANIFEST.relative_to(ROOT)}")
        sys.exit(0)
    r = verify_manifest()
    if r.get("error"):
        print(f"[INTEGRITY] {r['error']}")
        sys.exit(1)
    print(f"[INTEGRITY] Checked {r['checked']} files: "
          f"{len(r['modified'])} modified, {len(r['missing'])} missing, {len(r['untracked'])} not in manifest")
    for k in ("modified", "missing"):
        for f in r[k]:
            print(f"  {k.upper()}: {f}")
    sys.exit(0 if r["ok"] else 1)
