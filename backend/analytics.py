"""
Enterprise Analytics – aggregates over audit_logs / query_history.
"""
from datetime import datetime, timedelta, timezone

from db import db_connection, dict_cursor


def workspace_overview(workspace_id: int) -> dict:
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute("SELECT COUNT(*) AS c FROM workspace_members WHERE workspace_id=%s;",
                        (workspace_id,))
            users = cur.fetchone()["c"]

            cur.execute("SELECT COUNT(*) AS c FROM db_connections WHERE workspace_id=%s;",
                        (workspace_id,))
            dbs = cur.fetchone()["c"]

            cur.execute("SELECT COUNT(*) AS c FROM access_requests "
                        "WHERE workspace_id=%s AND status='pending';", (workspace_id,))
            pending = cur.fetchone()["c"]

            cur.execute(
                "SELECT COUNT(*) AS total, "
                "SUM(CASE WHEN success THEN 1 ELSE 0 END) AS ok, "
                "SUM(CASE WHEN success=FALSE THEN 1 ELSE 0 END) AS bad "
                "FROM audit_logs WHERE workspace_id=%s AND action='query';",
                (workspace_id,),
            )
            qs = cur.fetchone()
            total = qs["total"] or 0
            ok = qs["ok"] or 0
            bad = qs["bad"] or 0

            cur.execute(
                "SELECT COUNT(*) AS c FROM audit_logs "
                "WHERE workspace_id=%s AND action='query' AND created_at >= NOW() - INTERVAL '24 hours';",
                (workspace_id,),
            )
            queries_24h = cur.fetchone()["c"]

            cur.execute(
                "SELECT COUNT(DISTINCT user_id) AS c FROM audit_logs "
                "WHERE workspace_id=%s AND action='query' AND created_at >= NOW() - INTERVAL '7 days';",
                (workspace_id,),
            )
            active_7d = cur.fetchone()["c"]

    return {
        "total_users": users,
        "total_databases": dbs,
        "pending_requests": pending,
        "total_queries": total,
        "successful_queries": ok,
        "failed_queries": bad,
        "queries_last_24h": queries_24h,
        "active_users_7d": active_7d,
        "success_rate": round((ok / total) * 100, 1) if total else 0,
        "failure_rate": round((bad / total) * 100, 1) if total else 0,
    }


def queries_per_day(workspace_id: int, days: int = 14) -> list[dict]:
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                       COUNT(*) AS total,
                       SUM(CASE WHEN success THEN 1 ELSE 0 END) AS ok,
                       SUM(CASE WHEN success=FALSE THEN 1 ELSE 0 END) AS bad
                FROM audit_logs
                WHERE workspace_id=%s AND action='query'
                  AND created_at >= NOW() - (%s || ' days')::interval
                GROUP BY day
                ORDER BY day;
                """,
                (workspace_id, days),
            )
            rows = [dict(r) for r in cur.fetchall()]
    # Fill missing days
    by_day = {r["day"]: r for r in rows}
    out = []
    today = datetime.now(timezone.utc).date()
    for i in range(days - 1, -1, -1):
        d = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        r = by_day.get(d, {"day": d, "total": 0, "ok": 0, "bad": 0})
        out.append({"day": d, "total": int(r.get("total") or 0),
                    "ok": int(r.get("ok") or 0), "bad": int(r.get("bad") or 0)})
    return out


def top_databases(workspace_id: int, limit: int = 5) -> list[dict]:
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT d.id, d.name, COUNT(a.*) AS query_count
                FROM db_connections d
                LEFT JOIN audit_logs a ON a.db_id=d.id AND a.action='query'
                WHERE d.workspace_id=%s
                GROUP BY d.id, d.name
                ORDER BY query_count DESC
                LIMIT %s;
                """, (workspace_id, limit),
            )
            return [dict(r) for r in cur.fetchall()]


def top_users(workspace_id: int, limit: int = 5) -> list[dict]:
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                """
                SELECT u.id, u.name, u.email, COUNT(a.*) AS query_count
                FROM auth_users u
                JOIN audit_logs a ON a.user_id=u.id
                WHERE a.workspace_id=%s AND a.action='query'
                GROUP BY u.id, u.name, u.email
                ORDER BY query_count DESC
                LIMIT %s;
                """, (workspace_id, limit),
            )
            return [dict(r) for r in cur.fetchall()]
