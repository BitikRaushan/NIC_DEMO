"""
RBAC – Role-Based Access Control.

Roles (in order of permission):
  viewer  – SELECT only
  analyst – SELECT + analytical functions (no mutations)
  editor  – SELECT, INSERT, UPDATE
  admin   – full control inside workspace/db

Query types: SELECT, INSERT, UPDATE, DELETE, DDL
"""
from functools import wraps
from flask import g, jsonify

from db import db_connection, dict_cursor

ROLES = ["viewer", "analyst", "editor", "admin"]
ROLE_RANK = {r: i for i, r in enumerate(ROLES)}

# Allowed query types per role
ROLE_QUERY_PERMISSIONS = {
    "viewer":  {"SELECT"},
    "analyst": {"SELECT"},
    "editor":  {"SELECT", "INSERT", "UPDATE"},
    "admin":   {"SELECT", "INSERT", "UPDATE", "DELETE", "DDL"},
}

ROLE_DESCRIPTIONS = {
    "viewer":  "Read-only access. SELECT queries only.",
    "analyst": "Read-only with aggregations, views and analytical functions.",
    "editor":  "Can SELECT, INSERT and UPDATE. Cannot DELETE or modify schema.",
    "admin":   "Full control over this database.",
}


def workspace_role(workspace_id: int, user_id: int) -> str | None:
    """Return the user's role in a workspace, or None."""
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                "SELECT role FROM workspace_members WHERE workspace_id=%s AND user_id=%s;",
                (workspace_id, user_id),
            )
            row = cur.fetchone()
    return row["role"] if row else None


def db_role(db_id: int, user_id: int) -> str | None:
    """Return the user's effective role on a specific database.
    Db-level grant takes precedence; otherwise inherit workspace role if owner of workspace.
    """
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            # Direct db permission
            cur.execute(
                "SELECT role FROM db_permissions WHERE db_id=%s AND user_id=%s;",
                (db_id, user_id),
            )
            row = cur.fetchone()
            if row:
                return row["role"]
            # Fallback: workspace admin/owner inherits admin on every db
            cur.execute(
                "SELECT w.owner_id, wm.role "
                "FROM db_connections d "
                "JOIN workspaces w ON w.id = d.workspace_id "
                "LEFT JOIN workspace_members wm ON wm.workspace_id=w.id AND wm.user_id=%s "
                "WHERE d.id=%s;",
                (user_id, db_id),
            )
            r = cur.fetchone()
            if not r:
                return None
            if r["owner_id"] == user_id:
                return "admin"
            if r["role"] == "admin":
                return "admin"
    return None


def is_workspace_admin(workspace_id: int, user_id: int) -> bool:
    return workspace_role(workspace_id, user_id) == "admin" or _is_workspace_owner(workspace_id, user_id)


def _is_workspace_owner(workspace_id: int, user_id: int) -> bool:
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute("SELECT owner_id FROM workspaces WHERE id=%s;", (workspace_id,))
            row = cur.fetchone()
    return bool(row and row["owner_id"] == user_id)


def require_workspace_admin(view):
    @wraps(view)
    def wrapped(workspace_id, *args, **kwargs):
        user = g.current_user
        if user.get("is_platform_admin") or is_workspace_admin(workspace_id, user["id"]):
            return view(workspace_id, *args, **kwargs)
        return jsonify({"status": "error",
                        "message": "Workspace admin permission required."}), 403
    return wrapped


def role_allows(role: str | None, op: str) -> bool:
    if not role:
        return False
    return op in ROLE_QUERY_PERMISSIONS.get(role, set())
