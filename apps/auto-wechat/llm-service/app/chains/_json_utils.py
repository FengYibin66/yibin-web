"""Shared JSON parsing helpers for LLM chain outputs."""

from __future__ import annotations

import json


def parse_json_object(content: str) -> dict:
    text = content.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines and lines[-1].startswith("```") else lines[1:])
    return json.loads(text)
