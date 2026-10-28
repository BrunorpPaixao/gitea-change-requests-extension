#!/usr/bin/env python3
"""Validate a Gitea export and expose a small, canonical workset to the skill."""

import argparse
import json
import sys
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parent.parent
SHORT_KEY_MAP = json.loads((SKILL_ROOT / "references" / "short-key-map.json").read_text(encoding="utf-8"))
REVERSE_MAP = {path: {short: full for full, short in mapping.items()} for path, mapping in SHORT_KEY_MAP.items()}
SCHEMA_VERSION = "2.1-factual"


class InputError(ValueError):
    pass


def require_object(value, label):
    if not isinstance(value, dict):
        raise InputError(f"{label} must be an object")
    return value


def require_array(value, label):
    if not isinstance(value, list):
        raise InputError(f"{label} must be an array")
    return value


def normalize_short_keys(value, path=""):
    if isinstance(value, list):
        return [normalize_short_keys(item, f"{path}[]") for item in value]
    if not isinstance(value, dict):
        return value
    reverse = REVERSE_MAP.get(path, {})
    normalized = {}
    for key, item in value.items():
        full_key = reverse.get(key, key)
        if full_key in normalized:
            raise InputError(f"duplicate canonical key {full_key!r} at {path or 'top level'}")
        next_path = f"{path}.{full_key}" if path else full_key
        normalized[full_key] = normalize_short_keys(item, next_path)
    return normalized


def validate_conversations(items, label):
    require_array(items, label)
    for index, item in enumerate(items):
        require_object(item, f"{label}[{index}]")
        root = require_object(item.get("rootComment"), f"{label}[{index}].rootComment")
        if not isinstance(root.get("text"), str):
            raise InputError(f"{label}[{index}].rootComment.text must be a string")
        comments = require_array(item.get("comments"), f"{label}[{index}].comments")
        for reply_index, reply in enumerate(comments):
            require_object(reply, f"{label}[{index}].comments[{reply_index}]")
            if not isinstance(reply.get("text"), str):
                raise InputError(f"{label}[{index}].comments[{reply_index}].text must be a string")


def validate_completeness(value):
    completeness = require_object(value, "completeness")
    for key in ("allThreadsLoaded", "hiddenThreadsExpanded", "outdatedSectionsExpanded"):
        if not isinstance(completeness.get(key), bool):
            raise InputError(f"completeness.{key} must be a boolean")
    require_array(completeness.get("parseWarnings"), "completeness.parseWarnings")
    return completeness


def prepare(value):
    require_object(value, "input")
    format_name = value.get("format")
    if format_name == "gpre.review_queue.v1":
        data = value
        kind = "review_queue"
        scope = require_object(data.get("scope"), "scope")
        if scope.get("type") not in ("pull_request", "single_conversation"):
            raise InputError("scope.type must be pull_request or single_conversation")
        require_object(data.get("filters"), "filters")
        validate_completeness(data.get("completeness"))
        workset = [("included", item) for item in require_array(data.get("conversations"), "conversations")]
        validate_conversations(data["conversations"], "conversations")
    elif format_name == "gpre.review_delta.v1":
        data = value
        kind = "review_delta"
        require_object(data.get("filters"), "filters")
        validate_completeness(data.get("completeness"))
        new_items = require_array(data.get("newConversations"), "newConversations")
        changed_items = require_array(data.get("changedConversations"), "changedConversations")
        missing = require_array(data.get("missingFromCurrentView"), "missingFromCurrentView")
        if any(not isinstance(item, str) for item in missing):
            raise InputError("missingFromCurrentView must contain only strings")
        validate_conversations(new_items, "newConversations")
        validate_conversations(changed_items, "changedConversations")
        workset = [("new", item) for item in new_items] + [("changed", item) for item in changed_items]
        scope = {"type": "pull_request"}
    elif format_name is None:
        data = normalize_short_keys(value)
        kind = "canonical_export"
        scope = require_object(data.get("scope"), "scope")
        if scope.get("type") not in ("pull_request", "single_conversation"):
            raise InputError("scope.type must be pull_request or single_conversation")
        if scope["type"] == "pull_request":
            require_object(data.get("exportOptions"), "exportOptions")
            validate_completeness(data.get("completeness"))
        workset = [("included", item) for item in require_array(data.get("conversations"), "conversations")]
        validate_conversations(data["conversations"], "conversations")
    else:
        raise InputError(f"unsupported format {format_name!r}; update the git-changes skill")

    if data.get("schemaVersion") != SCHEMA_VERSION:
        raise InputError(f"unsupported schemaVersion {data.get('schemaVersion')!r}; expected {SCHEMA_VERSION}")
    source = require_object(data.get("source"), "source")
    if not isinstance(source.get("url"), str) or not source["url"]:
        raise InputError("source.url must be a nonempty string")
    if kind != "review_delta":
        require_object(data.get("actors"), "actors")
        require_object(data.get("identityResolution"), "identityResolution")

    return {
        "format": kind,
        "schemaVersion": SCHEMA_VERSION,
        "scope": scope,
        "source": {key: source.get(key) for key in ("url", "owner", "repo", "prNumber")},
        "filters": data.get("filters") if kind != "canonical_export" else data.get("exportOptions"),
        "completeness": data.get("completeness"),
        "identityResolution": data.get("identityResolution"),
        "workset": workset,
        "missingFromCurrentView": data.get("missingFromCurrentView", []) if kind == "review_delta" else [],
    }


def summary(prepared, offset, limit):
    workset = prepared["workset"]
    page = []
    for index in range(offset, min(offset + limit, len(workset))):
        change_kind, item = workset[index]
        page.append({
            "index": index,
            "id": item.get("conversationId") or item.get("threadKey"),
            "kind": change_kind,
            "filePath": item.get("filePath"),
            "threadUrl": item.get("threadUrl"),
        })
    return {
        **{key: prepared[key] for key in ("format", "schemaVersion", "scope", "source", "filters", "completeness", "identityResolution")},
        "total": len(workset),
        "offset": offset,
        "nextOffset": offset + len(page) if offset + len(page) < len(workset) else None,
        "items": page,
        "missingFromCurrentView": prepared["missingFromCurrentView"],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="JSON file path, or - for stdin")
    parser.add_argument("--item", type=int, help="print one canonical workset item by zero-based index")
    parser.add_argument("--offset", type=int, default=0, help="summary page offset")
    parser.add_argument("--limit", type=int, default=40, help="summary page size, 1 to 100")
    args = parser.parse_args()
    try:
        if args.offset < 0 or not 1 <= args.limit <= 100:
            raise InputError("offset must be nonnegative and limit must be between 1 and 100")
        raw = sys.stdin.read() if args.input == "-" else Path(args.input).read_text(encoding="utf-8")
        try:
            prepared = prepare(json.loads(raw))
        except json.JSONDecodeError as error:
            raise InputError(f"invalid JSON at line {error.lineno}, column {error.colno}") from error
        if args.item is None:
            result = summary(prepared, args.offset, args.limit)
        else:
            if not 0 <= args.item < len(prepared["workset"]):
                raise InputError(f"item index must be between 0 and {len(prepared['workset']) - 1}")
            change_kind, conversation = prepared["workset"][args.item]
            result = {key: prepared[key] for key in ("format", "scope", "source", "filters", "completeness", "identityResolution")}
            result.update({"index": args.item, "kind": change_kind, "conversation": conversation})
        print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    except (InputError, OSError, UnicodeError) as error:
        print(f"Invalid git-changes input: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
