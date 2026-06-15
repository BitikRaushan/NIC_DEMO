"""
Workspace service – CRUD + membership management.
"""
import re
import logging
from db import db_connection, dict_cursor

logger = logging.getLogger(__name__)


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", name.lower()).strip("-")
    return s or "workspace"


def _unique_slug(cur, base: str) -> str:
    slug = base
    i = 2
    while True:
        cur.execute("SELECT 1 FROM workspaces WHERE slug=%s;", (slug,))
        if not cur.fetchone():
            return slug
        slug = f"{base}-{i}"
        i += 1


def create_workspace(name: str, description: str, owner_id: int) -> dict:
    base_slug = _slugify(name)
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            slug = _unique_slug(cur, base_slug)
            cur.execute(
                "INSERT INTO workspaces (name, slug, description, owner_id) "
                "VALUES (%s,%s,%s,%s) RETURNING *;",
                (name, slug, description, owner_id),
            )
            ws = cur.fetchone()
            # add owner as admin member
            cur.execute(
                "INSERT INTO workspace_members (workspace_id, user_id, role) "
                "VALUES (%s,%s,'admin') ON CONFLICT DO NOTHING;",
                (ws["id"], owner_id),
            )
    return _serialize_workspace(ws)


def list_workspaces_for_user(user_id: int, is_platform_admin: bool = False) -> list[dict]:
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            if is_platform_admin:
                cur.execute("SELECT * FROM workspaces ORDER BY created_at DESC;")
            else:
                cur.execute(
                    "SELECT w.* FROM workspaces w "
                    "JOIN workspace_members m ON m.workspace_id = w.id "
                    "WHERE m.user_id=%s "
                    "ORDER BY w.created_at DESC;",
                    (user_id,),
                )
            rows = cur.fetchall()
    return [_serialize_workspace(r) for r in rows]


def get_workspace(workspace_id: int) -> dict | None:
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute("SELECT * FROM workspaces WHERE id=%s;", (workspace_id,))
            row = cur.fetchone()
    return _serialize_workspace(row) if row else None


def add_member(workspace_id: int, user_id: int, role: str = "viewer") -> dict | None:
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                "INSERT INTO workspace_members (workspace_id, user_id, role) "
                "VALUES (%s,%s,%s) "
                "ON CONFLICT (workspace_id, user_id) DO UPDATE SET role=EXCLUDED.role "
                "RETURNING *;",
                (workspace_id, user_id, role),
            )
            row = cur.fetchone()
    return dict(row) if row else None


def remove_member(workspace_id: int, user_id: int) -> bool:
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM workspace_members WHERE workspace_id=%s AND user_id=%s;",
                (workspace_id, user_id),
            )
            return cur.rowcount > 0


def list_members(workspace_id: int) -> list[dict]:
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                "SELECT m.id, m.role, m.joined_at, "
                "u.id AS user_id, u.name, u.email, u.is_platform_admin "
                "FROM workspace_members m "
                "JOIN auth_users u ON u.id = m.user_id "
                "WHERE m.workspace_id=%s "
                "ORDER BY m.joined_at ASC;",
                (workspace_id,),
            )
            return [dict(r) for r in cur.fetchall()]


def find_user_by_email(email: str) -> dict | None:
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute("SELECT id, name, email FROM auth_users WHERE email=%s;", (email.lower(),))
            row = cur.fetchone()
    return dict(row) if row else None


def _serialize_workspace(row) -> dict:
    if row is None:
        return None
    d = dict(row)
    for k in ("created_at",):
        if d.get(k):
            d[k] = d[k].isoformat()
    return d
