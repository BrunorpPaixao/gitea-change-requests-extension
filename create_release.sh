#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./create_release.sh --X.Y.Z [--dry-run]
  ./create_release.sh X.Y.Z [--dry-run]

Examples:
  ./create_release.sh --0.1.0
  ./create_release.sh 0.1.0 --dry-run
EOF
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 1
fi

dry_run="false"
version_arg=""

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      dry_run="true"
      ;;
    --*)
      if [[ -n "$version_arg" ]]; then
        echo "Error: multiple version arguments provided."
        usage
        exit 1
      fi
      version_arg="${arg#--}"
      ;;
    *)
      if [[ -n "$version_arg" ]]; then
        echo "Error: multiple version arguments provided."
        usage
        exit 1
      fi
      version_arg="$arg"
      ;;
  esac
done

if [[ -z "$version_arg" ]]; then
  echo "Error: version is required."
  usage
  exit 1
fi

if [[ ! "$version_arg" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: invalid version '$version_arg'. Expected X.Y.Z (e.g., 0.1.0)."
  exit 1
fi

if [[ "$dry_run" == "true" ]]; then
  echo "[dry-run] npm version $version_arg"
  echo "[dry-run] npm run release:package"
  exit 0
fi

echo "Setting version to $version_arg..."
npm version "$version_arg"

echo "Packaging release..."
npm run release:package

echo "Release complete."
