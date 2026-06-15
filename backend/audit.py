"""
Audit log helpers.
"""
import json
from db import db_connection, dict_cursor


def log_event(*, action, workspace_id=None, db_id=None, user_id=None,
              query_type=None, natural_prompt=None, generated_sql=None,
              execution_ms=None, row_count=None, success=None,
              error_message=None, metadata=None):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO audit_logs
                  (workspace_id, db_id, user_id, action, query_type,
                   natural_prompt, generated_sql, execution_ms, row_count,
                   success, error_message, metadata)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s);
                """,
                (workspace_id, db_id, user_id, action, query_type,
                 natural_prompt, generated_sql, execution_ms, row_count,
                 success, error_message,
                 json.dumps(metadata) if metadata is not None else None),
            )


def list_logs(*, workspace_id, db_id=None, user_id=None, query_type=None,
              start=None, end=None, limit=200, offset=0) -> list[dict]:
    where = ["a.workspace_id=%s"]
    args = [workspace_id]
    if db_id:
        where.append("a.db_id=%s")
        args.append(db_id)
    if user_id:
        where.append("a.user_id=%s")
        args.append(user_id)
    if query_type:
        where.append("a.query_type=%s")
        args.append(query_type)
    if start:
        where.append("a.created_at >= %s")
        args.append(start)
    if end:
        where.append("a.created_at <= %s")
        args.append(end)
    args.extend([limit, offset])
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                f"""
                SELECT a.*, u.name AS user_name, u.email AS user_email,
                       d.name AS db_name
                FROM audit_logs a
                LEFT JOIN auth_users u ON u.id = a.user_id
                LEFT JOIN db_connections d ON d.id = a.db_id
                WHERE {' AND '.join(where)}
                ORDER BY a.created_at DESC
                LIMIT %s OFFSET %s;
                """, args,
            )
            rows = cur.fetchall()
    out = []
    for r in rows:
        d = dict(r)
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        out.append(d)
    return out
