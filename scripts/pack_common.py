from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME_DIRS = {"src", "assets", "icons", "public", "_locales", "rules"}
FORBIDDEN_SUFFIXES = {".zip", ".xpi", ".pem", ".key", ".p12", ".env", ".map"}
DEBUG_FLAG = re.compile(r"(SHOW_DEBUG\s*=\s*)(?:true|false)(\s*;\s*//\s*@pack:debug)")


def validate_manifest(manifest: dict) -> list[str]:
    errors: list[str] = []
    if manifest.get("manifest_version") != 3:
        errors.append("manifest_version must be 3")

    references: list[str] = []
    background = manifest.get("background", {})
    references.extend(filter(None, [background.get("service_worker"), *background.get("scripts", [])]))
    action = manifest.get("action", {})
    for reference in (
        action.get("default_popup"),
        manifest.get("options_page"),
        manifest.get("options_ui", {}).get("page"),
    ):
        if reference:
            references.append(reference)
    references.extend(manifest.get("icons", {}).values())
    references.extend(action.get("default_icon", {}).values())
    for entry in manifest.get("content_scripts", []):
        references.extend(entry.get("js", []))
        references.extend(entry.get("css", []))

    for reference in references:
        path = Path(reference)
        if path.is_absolute() or ".." in path.parts:
            errors.append(f"manifest path escapes root: {reference}")
        elif not (ROOT / path).is_file():
            errors.append(f"manifest missing file: {reference}")
    return errors


def package_release(manifest_name: str, output_name: str) -> None:
    manifest_path = ROOT / manifest_name
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SystemExit(f"PACK FAIL {manifest_name}: {error}") from error

    errors = validate_manifest(manifest)
    if errors:
        raise SystemExit("PACK FAIL manifest validation:\n" + "\n".join(errors))

    files = sorted(
        (
            path for path in ROOT.rglob("*")
            if path.is_file()
            and path.relative_to(ROOT).parts[0] in RUNTIME_DIRS
            and path.suffix.lower() not in FORBIDDEN_SUFFIXES
            and not path.name.startswith(".env")
        ),
        key=lambda path: path.relative_to(ROOT).as_posix(),
    )

    debug_path = ROOT / "src" / "shared" / "debug-flag.js"
    if not debug_path.is_file():
        raise SystemExit("PACK FAIL missing src/shared/debug-flag.js")
    debug_source, debug_count = DEBUG_FLAG.subn(
        r"\1false\2", debug_path.read_text(encoding="utf-8"), count=1
    )
    if debug_count != 1:
        raise SystemExit("PACK FAIL expected exactly one @pack:debug marker")

    output = ROOT / output_name
    staging = output.with_suffix(output.suffix + ".tmp")
    try:
        with zipfile.ZipFile(staging, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
            for path in files:
                relative = path.relative_to(ROOT).as_posix()
                if path == debug_path:
                    archive.writestr(relative, debug_source)
                else:
                    archive.write(path, relative)
        staging.replace(output)
    finally:
        staging.unlink(missing_ok=True)
    print(f"OK {output} files={len(files) + 1}")
