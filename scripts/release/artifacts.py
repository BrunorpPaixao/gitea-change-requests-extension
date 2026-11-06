#!/usr/bin/env python3
"""Build deterministic runtime/skill archives from maintained source only."""
import argparse
import json
import os
import tempfile
import stat
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

SKILL_FILES = ("SKILL.md", "agents/openai.yaml", "references/short-key-map.json", "scripts/prepare_input.py")
EXCLUDED = {"AGENTS.md", "node_modules", "__pycache__", "dist", ".ai", ".cache"}
EXTENSIONS = {".js", ".html", ".css", ".json", ".png", ".svg", ".webp", ".jpg", ".jpeg", ".gif", ".woff2"}


def write_archive(output, files):
    contents = {}
    for name, source in sorted(files.items()):
        if source.is_symlink():
            raise ValueError(f"Refusing symlink in package: {source}")
        contents[name] = source.read_bytes()
    output.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=".gpre-package-", suffix=".zip", dir=output.parent)
    os.close(handle)
    try:
        with ZipFile(temporary, "w", ZIP_DEFLATED) as archive:
            for name, data in contents.items():
                info = ZipInfo(name, (1980, 1, 1, 0, 0, 0))
                info.compress_type = ZIP_DEFLATED
                info.external_attr = (0o100755 if name.endswith(".py") else 0o100644) << 16
                archive.writestr(info, data)
        with ZipFile(temporary) as archive:
            if archive.testzip() is not None or set(archive.namelist()) != set(contents):
                raise ValueError("Archive integrity check failed")
            for name, data in contents.items():
                if archive.read(name) != data:
                    raise ValueError(f"Archive differs from source: {name}")
        os.replace(temporary, output)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def package_skill(root, output):
    write_archive(output, {f"git-changes/{name}": root / "skills/git-changes" / name for name in SKILL_FILES})


def extension_files(root):
    package = json.loads((root / "package.json").read_text())
    manifest = json.loads((root / "manifest.json").read_text())
    if package["version"] != manifest["version"]:
        raise ValueError("Package and manifest versions must match")
    files = {name: root / name for name in ("manifest.json", "styles.css")}
    for directory in ("popup", "content", "shared", "icons"):
        for source in (root / directory).rglob("*"):
            relative = source.relative_to(root)
            if any(part in EXCLUDED or part.startswith(".") for part in relative.parts):
                continue
            if source.is_file() and source.suffix in EXTENSIONS:
                files[relative.as_posix()] = source
    return package, files


def verify_archive(path, files):
    with ZipFile(path) as archive:
        names = archive.namelist()
        if len(names) != len(files) or set(names) != set(files):
            raise ValueError("Unexpected or duplicate archive files")
        for name, source in files.items():
            info = archive.getinfo(name)
            if stat.S_ISLNK(info.external_attr >> 16) or info.file_size != source.stat().st_size:
                raise ValueError(f"Invalid archive member: {name}")
            if archive.read(name) != source.read_bytes():
                raise ValueError(f"Archive differs from tagged source: {name}")


def verify_packages(root, output):
    package, files = extension_files(root)
    stable = output / f"{package['name']}.zip"
    versioned = output / f"{package['name']}-v{package['version']}.zip"
    verify_archive(stable, files)
    verify_archive(versioned, files)
    if stable.read_bytes() != versioned.read_bytes():
        raise ValueError("Release archives differ")
    verify_archive(output / "skill.zip", {f"git-changes/{name}": root / "skills/git-changes" / name for name in SKILL_FILES})


def package_extension(root, output):
    package, files = extension_files(root)
    stable = output / f"{package['name']}.zip"
    versioned = output / f"{package['name']}-v{package['version']}.zip"
    write_archive(stable, files)
    write_archive(versioned, files)
    if stable.read_bytes() != versioned.read_bytes():
        raise ValueError("Release archives differ")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("skill", "extension", "verify"))
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    if args.mode == "skill":
        package_skill(root, (args.output or root / "skill.zip").resolve())
    elif args.mode == "verify":
        verify_packages(root, (args.output or root / "dist").resolve())
    else:
        package_extension(root, (args.output or root / "dist").resolve())
    print(f"Verified deterministic {args.mode} package")
