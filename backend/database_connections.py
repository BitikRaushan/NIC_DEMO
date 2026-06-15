"""
Database connections service.
- CRUD for registered external databases
- Test connection
- Schema discovery
- Encrypted credential storage
"""
import json
import logging

import psycopg2
import psycopg2.extras

from db import db_connection, dict_cursor
from crypto_utils import encrypt, decrypt

logger = logging.getLogger(__name__)


# ───────────────────────── External-DB connector ─────────────────────────────

def _connect_external(host, port, database, user, password, sslmode="disable", timeout=8):
    return psycopg2.connect(
        host=host, port=port, dbname=database,
        user=user, password=password, sslmode=sslmode,
        connect_timeout=timeout,
    )


def test_connection(host, port, database, user, password, db_type="postgresql",
                    sslmode="disable") -> tuple[bool, str]:
    if db_type.lower() != "postgresql":
        return False, f"DB type '{db_type}' not yet supported (architecture ready)."
    try:
        conn = _connect_external(host, port, database, user, password, sslmode)
        with conn.cursor() as cur:
            cur.execute("SELECT version();")
            version = cur.fetchone()[0]
        conn.close()
        return True, version
    except Exception as exc:
        return False, str(exc)


def discover_schema(host, port, database, user, password, sslmode="disable") -> list[dict]:
    """Return [{name, columns:[{name,type,is_pk,is_fk}], row_count_est}]."""
    conn = _connect_external(host, port, database, user, password, sslmode)
    tables = []
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema='public' AND table_type='BASE TABLE'
                ORDER BY table_name;
            """)
            table_names = [r[0] for r in cur.fetchall()]
        for table in table_names:
            with conn.cursor() as cur:
                cur.execute("SELECT reltuples::bigint FROM pg_class WHERE relname=%s;", (table,))
                row = cur.fetchone()
                count = int(row[0]) if row else 0
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT c.column_name, c.data_type,
                      CASE WHEN pk.column_name IS NOT NULL THEN TRUE ELSE FALSE END AS is_pk,
                      CASE WHEN fk.column_name IS NOT NULL THEN TRUE ELSE FALSE END AS is_fk
                    FROM information_schema.columns c
                    LEFT JOIN (
                      SELECT kcu.column_name FROM information_schema.table_constraints tc
                      JOIN information_schema.key_column_usage kcu
                        ON tc.constraint_name=kcu.constraint_name
                      WHERE tc.constraint_type='PRIMARY KEY' AND tc.table_name=%s
                    ) pk ON c.column_name = pk.column_name
                    LEFT JOIN (
                      SELECT kcu.column_name FROM information_schema.table_constraints tc
                      JOIN information_schema.key_column_usage kcu
                        ON tc.constraint_name=kcu.constraint_name
                      WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_name=%s
                    ) fk ON c.column_name = fk.column_name
                    WHERE c.table_name=%s AND c.table_schema='public'
                    ORDER BY c.ordinal_position;
                """, (table, table, table))
                cols = [dict(r) for r in cur.fetchall()]
            tables.append({"name": table, "row_count": count, "columns": cols})
    finally:
        conn.close()
    return tables


# ───────────────────────── CRUD on db_connections ────────────────────────────

def _serialize_db(row: dict) -> dict:
    d = dict(row)
    d.pop("db_password_enc", None)
    for k in ("created_at", "updated_at", "schema_synced_at"):
        if d.get(k):
            try:
                d[k] = d[k].isoformat()
            except AttributeError:
                pass
    return d


def create_db(workspace_id, name, db_type, host, port, database_name,
              username, password, sslmode, description) -> dict:
    enc = encrypt(password or "")
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                """
                INSERT INTO db_connections
                  (workspace_id, name, db_type, host, port, database_name,
                   db_username, db_password_enc, sslmode, description)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING *;
                """,
                (workspace_id, name, db_type, host, port, database_name,
                 username, enc, sslmode, description),
            )
            row = cur.fetchone()
    return _serialize_db(row)


def update_db(db_id, **fields) -> dict | None:
    allowed = {"name", "db_type", "host", "port", "database_name",
               "db_username", "sslmode", "description"}
    sets, vals = [], []
    for k, v in fields.items():
        if k in allowed and v is not None:
            sets.append(f"{k}=%s")
            vals.append(v)
    if "password" in fields and fields["password"]:
        sets.append("db_password_enc=%s")
        vals.append(encrypt(fields["password"]))
    if not sets:
        return get_db(db_id)
    sets.append("updated_at=NOW()")
    vals.append(db_id)
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(f"UPDATE db_connections SET {', '.join(sets)} WHERE id=%s RETURNING *;", vals)
            row = cur.fetchone()
    return _serialize_db(row) if row else None


def delete_db(db_id) -> bool:
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM db_connections WHERE id=%s;", (db_id,))
            return cur.rowcount > 0


def get_db(db_id) -> dict | None:
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute("SELECT * FROM db_connections WHERE id=%s;", (db_id,))
            row = cur.fetchone()
    return _serialize_db(row) if row else None


def get_db_with_creds(db_id) -> dict | None:
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute("SELECT * FROM db_connections WHERE id=%s;", (db_id,))
            row = cur.fetchone()
    if not row:
        return None
    d = dict(row)
    d["password"] = decrypt(d.pop("db_password_enc", ""))
    return d


def list_dbs_for_workspace(workspace_id: int) -> list[dict]:
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute("SELECT * FROM db_connections WHERE workspace_id=%s ORDER BY created_at DESC;",
                        (workspace_id,))
            return [_serialize_db(r) for r in cur.fetchall()]


def refresh_schema(db_id) -> dict | None:
    creds = get_db_with_creds(db_id)
    if not creds:
        return None
    tables = discover_schema(
        creds["host"], creds["port"], creds["database_name"],
        creds["db_username"], creds["password"], creds.get("sslmode") or "disable",
    )
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                "UPDATE db_connections SET schema_cache=%s, schema_synced_at=NOW() "
                "WHERE id=%s RETURNING *;",
                (json.dumps(tables), db_id),
            )
            row = cur.fetchone()
    return _serialize_db(row) if row else None


# ───────────────────────── Permissions on dbs ────────────────────────────────

def grant_db_permission(db_id: int, user_id: int, role: str, granted_by: int) -> dict:
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                "INSERT INTO db_permissions (db_id, user_id, role, granted_by) "
                "VALUES (%s,%s,%s,%s) "
                "ON CONFLICT (db_id, user_id) DO UPDATE SET role=EXCLUDED.role, "
                "granted_by=EXCLUDED.granted_by, granted_at=NOW() RETURNING *;",
                (db_id, user_id, role, granted_by),
            )
            return dict(cur.fetchone())


def revoke_db_permission(db_id: int, user_id: int) -> bool:
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM db_permissions WHERE db_id=%s AND user_id=%s;",
                        (db_id, user_id))
            return cur.rowcount > 0


def list_db_permissions(db_id: int) -> list[dict]:
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                "SELECT p.id, p.role, p.granted_at, u.id AS user_id, u.name, u.email "
                "FROM db_permissions p JOIN auth_users u ON u.id=p.user_id "
                "WHERE p.db_id=%s ORDER BY p.granted_at ASC;",
                (db_id,),
            )
            return [dict(r) for r in cur.fetchall()]


# ───────────────────────── Table-level Permissions ───────────────────────────

def set_table_permissions(db_id: int, user_id: int, mode: str, tables: list[str]) -> dict:
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                "INSERT INTO table_permissions (db_id, user_id, mode, tables) "
                "VALUES (%s,%s,%s,%s) "
                "ON CONFLICT (db_id, user_id) DO UPDATE "
                "  SET mode=EXCLUDED.mode, tables=EXCLUDED.tables, updated_at=NOW() "
                "RETURNING *;",
                (db_id, user_id, mode, json.dumps(tables)),
            )
            return dict(cur.fetchone())


def get_table_permissions(db_id: int, user_id: int) -> dict | None:
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                "SELECT mode, tables FROM table_permissions WHERE db_id=%s AND user_id=%s;",
                (db_id, user_id),
            )
            row = cur.fetchone()
    return dict(row) if row else None


def filter_schema_for_user(schema_cache: list[dict], db_id: int, user_id: int) -> list[dict]:
    """Apply table-level permissions to a discovered schema."""
    perm = get_table_permissions(db_id, user_id)
    if not perm:
        return schema_cache or []
    tables = set([t.lower() for t in (perm.get("tables") or [])])
    mode = perm.get("mode", "restricted")
    if mode == "allowed":
        return [t for t in (schema_cache or []) if t["name"].lower() in tables]
    # restricted: hide listed
    return [t for t in (schema_cache or []) if t["name"].lower() not in tables]
