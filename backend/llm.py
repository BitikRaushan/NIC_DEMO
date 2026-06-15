"""
QueryBridge – LLM Translation Layer (Ollama-first with rule-based fallback)
"""
import logging
import re
import requests

from config import Config

logger = logging.getLogger(__name__)


def _schema_prompt(tables: list[dict]) -> str:
    if not tables:
        return "No tables available."
    lines = []
    for t in tables:
        cols = []
        for c in t.get("columns", []) or []:
            if isinstance(c, dict):
                col_name = c.get("column_name") or c.get("name") or ""
                tag = ""
                if c.get("is_pk"):
                    tag = " (PK)"
                elif c.get("is_fk"):
                    tag = " (FK)"
                cols.append(f"{col_name} {c.get('data_type','')}{tag}".strip())
            else:
                cols.append(str(c))
        lines.append(f"- {t['name']}({', '.join(cols)})")
    return "\n".join(lines)


def build_system_prompt(tables: list[dict], allowed_ops: set[str]) -> str:
    ops = ", ".join(sorted(allowed_ops)) if allowed_ops else "SELECT"
    return f"""You are QueryBridge, an expert PostgreSQL query generator.

Convert the user's natural-language question into a syntactically correct
PostgreSQL statement using ONLY the tables listed below.

Strict rules:
- Output ONLY the SQL statement (no markdown, no backticks, no commentary).
- Allowed statement types for THIS user: {ops}. NEVER produce others.
- If the user's request requires an operation outside the allowed list,
  return exactly:  SELECT 'Operation not permitted for your role' AS message;
- Apply LIMIT 100 to SELECT queries when no explicit limit is requested.
- Use ANSI SQL compatible with PostgreSQL 15.
- Output ONLY ONE SQL statement.
- Never explain the query.
- Never describe tables.
- Never use natural language.
- Your first character MUST be S, I, U, D, W, C, A, T.
- If unsure, output:
  SELECT 'Unable to generate query' AS message;

Authorized tables:
{_schema_prompt(tables)}
"""


def count_tokens(prompt: str, sql: str, system_prompt: str = "") -> int:
    combined = system_prompt + prompt + sql
    return max(1, len(combined) // 4)


def _clean_sql(raw: str) -> str:
    cleaned = re.sub(r"```(?:sql)?\s*", "", raw, flags=re.IGNORECASE)
    cleaned = cleaned.replace("```", "").strip()
    m = re.search(r"((?:WITH|SELECT|INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b.*)",
                  cleaned, re.IGNORECASE | re.DOTALL)
    if m:
        cleaned = m.group(1).strip()
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    if not cleaned.endswith(";"):
        cleaned += ";"
    return cleaned


def translate_with_ollama(prompt: str, system_prompt: str) -> str:
    payload = {
        "model": Config.OLLAMA_MODEL,
        "stream": False,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
    }
    try:
        resp = requests.post(f"{Config.OLLAMA_BASE_URL}/api/chat",
                             json=payload, timeout=Config.OLLAMA_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        text = (data.get("message", {}).get("content", "")
                or data.get("response", "")).strip()
        if not text:
            raise RuntimeError("Empty Ollama response")
        return _clean_sql(text)
    except requests.exceptions.ConnectionError:
        raise RuntimeError("Ollama unreachable")
    except requests.exceptions.Timeout:
        raise RuntimeError("Ollama timeout")
    except Exception as exc:
        raise RuntimeError(f"Ollama error: {exc}")


# ─── Heuristic fallback (rule-based) ─────────────────────────────────────────

def fallback_translate(prompt: str, tables: list[dict]) -> str:
    """Very small heuristic SQL synthesiser used when Ollama is unreachable."""
    p = (prompt or "").lower().strip()
    if not tables:
        return "SELECT 'No tables available' AS message;"

    # 1. Exact "show all from <table>" patterns
    for t in tables:
        name = t["name"].lower()
        if name in p and any(kw in p for kw in ["all", "list", "show", "rows", "data"]):
            return f"SELECT * FROM {t['name']} LIMIT 100;"

    # 2. Count patterns
    if "count" in p or "how many" in p:
        for t in tables:
            if t["name"].lower() in p:
                return f"SELECT COUNT(*) AS total FROM {t['name']};"
        return f"SELECT COUNT(*) AS total FROM {tables[0]['name']};"

    # 3. Top N: salary / cgpa / amount ...
    m = re.search(r"top\s+(\d+)", p)
    if m:
        n = int(m.group(1))
        for t in tables:
            if t["name"].lower() in p:
                return f"SELECT * FROM {t['name']} LIMIT {n};"
        return f"SELECT * FROM {tables[0]['name']} LIMIT {n};"

    # 4. Default: first matching table
    for t in tables:
        if t["name"].lower() in p:
            return f"SELECT * FROM {t['name']} LIMIT 25;"

    return f"SELECT * FROM {tables[0]['name']} LIMIT 25;"


def translate(prompt: str, tables: list[dict], allowed_ops: set[str]) -> tuple[str, str]:
    """Return (sql, mode) where mode is 'ollama' or 'fallback'."""
    system_prompt = build_system_prompt(tables, allowed_ops)
    try:
        # sql = translate_with_ollama(prompt, system_prompt)
        # return sql, "ollama"
        sql = translate_with_ollama(prompt, system_prompt)

        if not re.match(
            r"^\s*(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|DROP|ALTER|TRUNCATE)\b",
            sql,
            re.IGNORECASE
        ):
            raise RuntimeError("Non SQL output")

        return sql, "ollama"
    except Exception as exc:
        logger.warning("Falling back to rule-based translator: %s", exc)
        return fallback_translate(prompt, tables), "fallback"
