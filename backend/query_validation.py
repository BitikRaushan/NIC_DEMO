"""
Query Validation & Risk Engine.

- Classify SQL into op type (SELECT, INSERT, UPDATE, DELETE, DDL)
- Risk scoring (DROP / DELETE-without-WHERE / TRUNCATE / mass UPDATE / ALTER)
"""
import re
from dataclasses import dataclass, asdict

import sqlglot
from sqlglot import expressions as exp


DDL_TOKENS = {"DROP", "ALTER", "CREATE", "TRUNCATE", "GRANT", "REVOKE", "RENAME"}


@dataclass
class QueryClassification:
    op: str              # SELECT | INSERT | UPDATE | DELETE | DDL | UNKNOWN
    is_high_risk: bool
    reasons: list[str]
    tables: list[str]
    parsed_ok: bool


def _classify_token(sql: str) -> str:
    """Quick keyword classification fallback when sqlglot cannot parse."""
    s = sql.strip().lstrip("(").upper()
    if s.startswith("SELECT") or s.startswith("WITH"):
        return "SELECT"
    if s.startswith("INSERT"):
        return "INSERT"
    if s.startswith("UPDATE"):
        return "UPDATE"
    if s.startswith("DELETE"):
        return "DELETE"
    for tok in DDL_TOKENS:
        if re.match(rf"^\s*{tok}\b", s):
            return "DDL"
    return "UNKNOWN"


def classify(sql: str) -> QueryClassification:
    sql = (sql or "").strip().rstrip(";")
    if not sql:
        return QueryClassification("UNKNOWN", False, ["Empty query"], [], False)

    op = _classify_token(sql)
    reasons: list[str] = []
    tables: list[str] = []
    parsed_ok = False

    try:
        tree = sqlglot.parse_one(sql, read="postgres")
        parsed_ok = True
        if isinstance(tree, exp.Select):
            op = "SELECT"
        elif isinstance(tree, exp.Insert):
            op = "INSERT"
        elif isinstance(tree, exp.Update):
            op = "UPDATE"
            if not tree.args.get("where"):
                reasons.append("UPDATE without WHERE clause (mass update).")
        elif isinstance(tree, exp.Delete):
            op = "DELETE"
            if not tree.args.get("where"):
                reasons.append("DELETE without WHERE clause.")
        elif isinstance(tree, (exp.Drop, exp.Alter, exp.Create, exp.TruncateTable)):
            op = "DDL"
            cls = tree.__class__.__name__.upper()
            reasons.append(f"{cls} statement detected.")
        tables = list({t.name for t in tree.find_all(exp.Table) if t.name})
    except Exception:
        # Best-effort fallback
        if op == "DDL":
            reasons.append("DDL statement detected via keyword scan.")
        if op == "DELETE" and not re.search(r"\bWHERE\b", sql, re.IGNORECASE):
            reasons.append("DELETE without WHERE clause.")
        if op == "UPDATE" and not re.search(r"\bWHERE\b", sql, re.IGNORECASE):
            reasons.append("UPDATE without WHERE clause (mass update).")

    # Extra heuristics
    if re.search(r"\bTRUNCATE\b", sql, re.IGNORECASE):
        reasons.append("TRUNCATE detected.")
    if re.search(r"\bDROP\s+(TABLE|DATABASE|SCHEMA)\b", sql, re.IGNORECASE):
        reasons.append("DROP TABLE/DATABASE/SCHEMA detected.")

    is_high_risk = op in ("DELETE", "DDL") or bool(reasons)
    if op == "INSERT" or op == "UPDATE":
        # Only mark high risk if reasons exist
        is_high_risk = bool(reasons)
    if op == "SELECT":
        is_high_risk = False

    return QueryClassification(op=op, is_high_risk=is_high_risk,
                               reasons=reasons, tables=tables, parsed_ok=parsed_ok)


def to_dict(c: QueryClassification) -> dict:
    return asdict(c)
