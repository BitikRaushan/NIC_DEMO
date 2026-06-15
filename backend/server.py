"""
QueryBridge – Enterprise Flask API (exposed as ASGI via asgiref).

Mounted under /api by the platform ingress.
Backwards-compatible with the legacy endpoints (login/register/me/generate)
while adding workspace, RBAC, database registration, access requests,
audit logging, analytics and query-history endpoints.
"""
import logging
import time
import psycopg2

from asgiref.wsgi import WsgiToAsgi
from flask import Flask, g, jsonify, request
from flask_cors import CORS

from auth import (authenticate_user, create_token, create_user, get_current_user,
                  login_required, find_user_by_email as auth_find_user)
from config import Config
from db import db_connection, dict_cursor
from schema import init_schema
from permissions import (ROLES, ROLE_DESCRIPTIONS, ROLE_QUERY_PERMISSIONS,
                         db_role, workspace_role, is_workspace_admin,
                         require_workspace_admin, role_allows)
import workspace as ws_svc
import database_connections as dbc
from query_validation import classify, to_dict as classify_dict
import audit
import analytics
import llm as llm_svc
from crypto_utils import decrypt
import psycopg2.extras as pgx
from seed import seed_demo
from datetime import date, datetime
from decimal import Decimal


def _json_safe(v):
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, dict):
        return {k: _json_safe(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_json_safe(x) for x in v]
    return v


def _serialize_rows(columns, rows):
    return [{c: _json_safe(r.get(c)) for c in columns} for r in rows]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

flask_app = Flask(__name__)
flask_app.config.from_object(Config)

# CORS – allow our preview origin and "*" fallback
CORS(flask_app, resources={r"/api/*": {"origins": Config.CORS_ORIGINS}},
     supports_credentials=False)

# Initialize schema + seed admin/demo on boot
try:
    init_schema()
    seed_demo()
except Exception as exc:
    logger.warning("Schema/seed initialization issue: %s", exc)


# ─────────────────────── Helpers ─────────────────────────────────────────────

def ok(data: dict | None = None, status: int = 200):
    return jsonify({"status": "ok", **(data or {})}), status


def err(message: str, status: int = 400, **extra):
    return jsonify({"status": "error", "message": message, **extra}), status


def _auth_payload(user: dict, status: int = 200):
    return ok({"user": user, "token": create_token(user)}, status)


def _query_op_to_required(op: str) -> str:
    """Map classified op → permission keyword used by ROLE_QUERY_PERMISSIONS."""
    if op == "UNKNOWN":
        return "SELECT"
    return op


# ─────────────────────── Health & Schema ─────────────────────────────────────

@flask_app.route("/api/health", methods=["GET"])
def health():
    db_ok = False
    db_error = None
    try:
        with db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        db_ok = True
    except Exception as exc:
        db_error = str(exc)
    return ok({
        "service": "QueryBridge API",
        "version": "2.0.0-enterprise",
        "llm_model": Config.OLLAMA_MODEL,
        "database": "PostgreSQL" if db_ok else "unavailable",
        "db_connected": db_ok,
        "db_error": db_error,
    })


# ─────────────────────── Auth ────────────────────────────────────────────────

@flask_app.route("/api/auth/register", methods=["POST"])
def register():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if len(name) < 2:
        return err("Name must be at least 2 characters.")
    if "@" not in email or "." not in email:
        return err("A valid email address is required.")
    if len(password) < 8:
        return err("Password must be at least 8 characters.")

    try:
        user = create_user(name, email, password)
        audit.log_event(action="register", user_id=user["id"], success=True)
        return _auth_payload(user, 201)
    except psycopg2.errors.UniqueViolation:
        return err("An account with this email already exists.", 409)
    except Exception as exc:
        logger.error("Registration failed: %s", exc, exc_info=True)
        return err(f"Registration failed: {exc}", 500)


@flask_app.route("/api/auth/login", methods=["POST"])
def login():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    if not email or not password:
        return err("Email and password are required.")
    try:
        user = authenticate_user(email, password)
        if not user:
            return err("Invalid email or password.", 401)
        audit.log_event(action="login", user_id=user["id"], success=True)
        return _auth_payload(user)
    except Exception as exc:
        logger.error("Login failed: %s", exc, exc_info=True)
        return err(f"Login failed: {exc}", 500)


@flask_app.route("/api/auth/me", methods=["GET"])
def me():
    user = get_current_user()
    if not user:
        return err("Authentication required.", 401)
    return ok({"user": user})


# ─────────────────────── Workspaces ──────────────────────────────────────────

@flask_app.route("/api/workspaces", methods=["GET"])
@login_required
def list_workspaces():
    u = g.current_user
    items = ws_svc.list_workspaces_for_user(u["id"], u.get("is_platform_admin", False))
    return ok({"workspaces": items})


@flask_app.route("/api/workspaces", methods=["POST"])
@login_required
def create_workspace():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return err("Workspace name is required.")
    desc = body.get("description") or ""
    ws = ws_svc.create_workspace(name, desc, g.current_user["id"])
    return ok({"workspace": ws}, 201)


@flask_app.route("/api/workspaces/<int:workspace_id>", methods=["GET"])
@login_required
def get_workspace(workspace_id):
    ws = ws_svc.get_workspace(workspace_id)
    if not ws:
        return err("Workspace not found.", 404)
    role = workspace_role(workspace_id, g.current_user["id"])
    if not role and not g.current_user.get("is_platform_admin"):
        return err("Not a member of this workspace.", 403)
    return ok({"workspace": ws, "role": role or "platform_admin"})


@flask_app.route("/api/workspaces/<int:workspace_id>/members", methods=["GET"])
@login_required
@require_workspace_admin
def list_members(workspace_id):
    return ok({"members": ws_svc.list_members(workspace_id)})


@flask_app.route("/api/workspaces/<int:workspace_id>/members", methods=["POST"])
@login_required
@require_workspace_admin
def invite_member(workspace_id):
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    role = (body.get("role") or "viewer").lower()
    if role not in ROLES:
        return err(f"Invalid role. Allowed: {ROLES}")
    user = ws_svc.find_user_by_email(email)
    if not user:
        return err("User with this email does not exist. They must register first.", 404)
    m = ws_svc.add_member(workspace_id, user["id"], role)
    audit.log_event(action="add_member", workspace_id=workspace_id,
                    user_id=g.current_user["id"], success=True,
                    metadata={"member_id": user["id"], "role": role})
    return ok({"member": m, "user": user}, 201)


@flask_app.route("/api/workspaces/<int:workspace_id>/members/<int:user_id>", methods=["PATCH"])
@login_required
@require_workspace_admin
def update_member(workspace_id, user_id):
    body = request.get_json(silent=True) or {}
    role = (body.get("role") or "").lower()
    if role not in ROLES:
        return err(f"Invalid role. Allowed: {ROLES}")
    m = ws_svc.add_member(workspace_id, user_id, role)
    audit.log_event(action="update_member", workspace_id=workspace_id,
                    user_id=g.current_user["id"], success=True,
                    metadata={"member_id": user_id, "role": role})
    return ok({"member": m})


@flask_app.route("/api/workspaces/<int:workspace_id>/members/<int:user_id>", methods=["DELETE"])
@login_required
@require_workspace_admin
def delete_member(workspace_id, user_id):
    removed = ws_svc.remove_member(workspace_id, user_id)
    audit.log_event(action="remove_member", workspace_id=workspace_id,
                    user_id=g.current_user["id"], success=removed,
                    metadata={"member_id": user_id})
    return ok({"removed": removed})


@flask_app.route("/api/roles", methods=["GET"])
@login_required
def roles_info():
    return ok({
        "roles": [
            {"role": r, "description": ROLE_DESCRIPTIONS[r],
             "permissions": sorted(list(ROLE_QUERY_PERMISSIONS[r]))}
            for r in ROLES
        ]
    })


# ─────────────────────── Database Connections ────────────────────────────────

@flask_app.route("/api/workspaces/<int:workspace_id>/databases", methods=["GET"])
@login_required
def list_dbs(workspace_id):
    u = g.current_user
    role = workspace_role(workspace_id, u["id"])
    if not role and not u.get("is_platform_admin"):
        return err("Not a member of this workspace.", 403)
    items = dbc.list_dbs_for_workspace(workspace_id)
    # annotate each db with current user's role on it
    for d in items:
        d["my_role"] = db_role(d["id"], u["id"])
    return ok({"databases": items})


@flask_app.route("/api/workspaces/<int:workspace_id>/databases/test", methods=["POST"])
@login_required
@require_workspace_admin
def test_db(workspace_id):
    body = request.get_json(silent=True) or {}
    success, info = dbc.test_connection(
        host=body.get("host"), port=int(body.get("port", 5432)),
        database=body.get("database_name"), user=body.get("db_username"),
        password=body.get("db_password", ""), db_type=body.get("db_type", "postgresql"),
        sslmode=body.get("sslmode", "disable"),
    )
    return ok({"connected": success, "info": info})


@flask_app.route("/api/workspaces/<int:workspace_id>/databases", methods=["POST"])
@login_required
@require_workspace_admin
def create_db(workspace_id):
    body = request.get_json(silent=True) or {}
    required = ["name", "host", "port", "database_name", "db_username", "db_password"]
    for k in required:
        if not body.get(k) and k != "db_password":  # allow blank password just in case
            return err(f"Field '{k}' is required.")
    success, info = dbc.test_connection(
        host=body["host"], port=int(body["port"]),
        database=body["database_name"], user=body["db_username"],
        password=body.get("db_password", ""),
        db_type=body.get("db_type", "postgresql"),
        sslmode=body.get("sslmode", "disable"),
    )
    if not success:
        return err(f"Test connection failed: {info}", 400, info=info)

    rec = dbc.create_db(
        workspace_id=workspace_id, name=body["name"],
        db_type=body.get("db_type", "postgresql"),
        host=body["host"], port=int(body["port"]),
        database_name=body["database_name"], username=body["db_username"],
        password=body.get("db_password", ""),
        sslmode=body.get("sslmode", "disable"),
        description=body.get("description", ""),
    )
    # refresh schema
    try:
        rec = dbc.refresh_schema(rec["id"]) or rec
    except Exception as exc:
        logger.warning("Schema refresh after create failed: %s", exc)
    audit.log_event(action="add_database", workspace_id=workspace_id,
                    db_id=rec["id"], user_id=g.current_user["id"], success=True)
    return ok({"database": rec}, 201)


@flask_app.route("/api/workspaces/<int:workspace_id>/databases/<int:db_id>", methods=["PATCH"])
@login_required
@require_workspace_admin
def update_db(workspace_id, db_id):
    body = request.get_json(silent=True) or {}
    field_map = {
        "name": body.get("name"), "db_type": body.get("db_type"),
        "host": body.get("host"), "port": body.get("port"),
        "database_name": body.get("database_name"),
        "db_username": body.get("db_username"),
        "password": body.get("db_password"),
        "sslmode": body.get("sslmode"), "description": body.get("description"),
    }
    rec = dbc.update_db(db_id, **field_map)
    if not rec:
        return err("Database not found.", 404)
    audit.log_event(action="update_database", workspace_id=workspace_id,
                    db_id=db_id, user_id=g.current_user["id"], success=True)
    return ok({"database": rec})


@flask_app.route("/api/workspaces/<int:workspace_id>/databases/<int:db_id>", methods=["DELETE"])
@login_required
@require_workspace_admin
def delete_db(workspace_id, db_id):
    removed = dbc.delete_db(db_id)
    audit.log_event(action="delete_database", workspace_id=workspace_id,
                    db_id=db_id, user_id=g.current_user["id"], success=removed)
    return ok({"removed": removed})


@flask_app.route("/api/workspaces/<int:workspace_id>/databases/<int:db_id>/refresh-schema",
                 methods=["POST"])
@login_required
@require_workspace_admin
def refresh_schema_endpoint(workspace_id, db_id):
    rec = dbc.refresh_schema(db_id)
    if not rec:
        return err("Database not found.", 404)
    return ok({"database": rec})


@flask_app.route("/api/workspaces/<int:workspace_id>/databases/<int:db_id>/schema",
                 methods=["GET"])
@login_required
def get_db_schema(workspace_id, db_id):
    u = g.current_user
    role = db_role(db_id, u["id"])
    if not role and not u.get("is_platform_admin"):
        return err("You do not currently have access to this database.", 403,
                   code="NO_DB_ACCESS")
    rec = dbc.get_db(db_id)
    if not rec:
        return err("Database not found.", 404)
    schema_cache = rec.get("schema_cache") or []
    filtered = dbc.filter_schema_for_user(schema_cache, db_id, u["id"])
    return ok({"schema": filtered, "my_role": role or "admin",
               "schema_synced_at": rec.get("schema_synced_at")})


@flask_app.route("/api/workspaces/<int:workspace_id>/databases/<int:db_id>/permissions",
                 methods=["GET"])
@login_required
@require_workspace_admin
def list_db_perms(workspace_id, db_id):
    perms = dbc.list_db_permissions(db_id)
    return ok({"permissions": perms})


@flask_app.route("/api/workspaces/<int:workspace_id>/databases/<int:db_id>/permissions",
                 methods=["POST"])
@login_required
@require_workspace_admin
def grant_db_perm(workspace_id, db_id):
    body = request.get_json(silent=True) or {}
    user_id = body.get("user_id")
    role = (body.get("role") or "viewer").lower()
    if role not in ROLES:
        return err(f"Invalid role. Allowed: {ROLES}")
    if not user_id:
        return err("user_id is required.")
    p = dbc.grant_db_permission(db_id, user_id, role, g.current_user["id"])
    audit.log_event(action="grant_db", workspace_id=workspace_id, db_id=db_id,
                    user_id=g.current_user["id"], success=True,
                    metadata={"granted_to": user_id, "role": role})
    return ok({"permission": p}, 201)


@flask_app.route("/api/workspaces/<int:workspace_id>/databases/<int:db_id>/permissions/<int:user_id>",
                 methods=["DELETE"])
@login_required
@require_workspace_admin
def revoke_db_perm(workspace_id, db_id, user_id):
    removed = dbc.revoke_db_permission(db_id, user_id)
    audit.log_event(action="revoke_db", workspace_id=workspace_id, db_id=db_id,
                    user_id=g.current_user["id"], success=removed,
                    metadata={"revoked_from": user_id})
    return ok({"removed": removed})


@flask_app.route("/api/workspaces/<int:workspace_id>/databases/<int:db_id>/table-permissions",
                 methods=["POST"])
@login_required
@require_workspace_admin
def set_table_perms(workspace_id, db_id):
    body = request.get_json(silent=True) or {}
    p = dbc.set_table_permissions(
        db_id, body.get("user_id"),
        body.get("mode", "restricted"), body.get("tables") or [],
    )
    return ok({"table_permission": p})


# ─────────────────────── Access Requests ─────────────────────────────────────

@flask_app.route("/api/workspaces/<int:workspace_id>/access-requests", methods=["POST"])
@login_required
def create_access_request(workspace_id):
    body = request.get_json(silent=True) or {}
    db_id = body.get("db_id")
    role = (body.get("requested_role") or "viewer").lower()
    reason = body.get("reason") or ""
    if not db_id:
        return err("db_id is required.")
    if role not in ROLES:
        return err(f"Invalid role. Allowed: {ROLES}")
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                "INSERT INTO access_requests "
                "(workspace_id, db_id, user_id, requested_role, reason) "
                "VALUES (%s,%s,%s,%s,%s) RETURNING *;",
                (workspace_id, db_id, g.current_user["id"], role, reason),
            )
            r = cur.fetchone()
    audit.log_event(action="request_access", workspace_id=workspace_id,
                    db_id=db_id, user_id=g.current_user["id"], success=True,
                    metadata={"requested_role": role, "reason": reason})
    return ok({"request": dict(r)}, 201)


@flask_app.route("/api/workspaces/<int:workspace_id>/access-requests", methods=["GET"])
@login_required
def list_access_requests(workspace_id):
    u = g.current_user
    is_admin = is_workspace_admin(workspace_id, u["id"]) or u.get("is_platform_admin")
    where = ["a.workspace_id=%s"]
    args = [workspace_id]
    if not is_admin:
        where.append("a.user_id=%s")
        args.append(u["id"])
    status = request.args.get("status")
    if status:
        where.append("a.status=%s")
        args.append(status)
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                f"""
                SELECT a.*, u.name AS user_name, u.email AS user_email,
                       d.name AS db_name
                FROM access_requests a
                LEFT JOIN auth_users u ON u.id = a.user_id
                LEFT JOIN db_connections d ON d.id = a.db_id
                WHERE {' AND '.join(where)}
                ORDER BY a.created_at DESC;
                """, args,
            )
            rows = [dict(r) for r in cur.fetchall()]
    return ok({"requests": rows})


@flask_app.route("/api/workspaces/<int:workspace_id>/access-requests/<int:req_id>/approve",
                 methods=["POST"])
@login_required
@require_workspace_admin
def approve_request(workspace_id, req_id):
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute("SELECT * FROM access_requests WHERE id=%s AND workspace_id=%s;",
                        (req_id, workspace_id))
            r = cur.fetchone()
            if not r:
                return err("Request not found.", 404)
            if r["status"] != "pending":
                return err(f"Request already {r['status']}.", 400)
            cur.execute(
                "UPDATE access_requests SET status='approved', reviewer_id=%s, reviewed_at=NOW() "
                "WHERE id=%s RETURNING *;",
                (g.current_user["id"], req_id),
            )
            updated = cur.fetchone()
    # Grant db permission
    dbc.grant_db_permission(r["db_id"], r["user_id"], r["requested_role"], g.current_user["id"])
    audit.log_event(action="approve_access", workspace_id=workspace_id, db_id=r["db_id"],
                    user_id=g.current_user["id"], success=True,
                    metadata={"request_id": req_id, "granted_to": r["user_id"],
                              "role": r["requested_role"]})
    return ok({"request": dict(updated)})


@flask_app.route("/api/workspaces/<int:workspace_id>/access-requests/<int:req_id>/reject",
                 methods=["POST"])
@login_required
@require_workspace_admin
def reject_request(workspace_id, req_id):
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute("SELECT * FROM access_requests WHERE id=%s AND workspace_id=%s;",
                        (req_id, workspace_id))
            r = cur.fetchone()
            if not r:
                return err("Request not found.", 404)
            cur.execute(
                "UPDATE access_requests SET status='rejected', reviewer_id=%s, reviewed_at=NOW() "
                "WHERE id=%s RETURNING *;",
                (g.current_user["id"], req_id),
            )
            updated = cur.fetchone()
    audit.log_event(action="reject_access", workspace_id=workspace_id, db_id=r["db_id"],
                    user_id=g.current_user["id"], success=True,
                    metadata={"request_id": req_id})
    return ok({"request": dict(updated)})


# ─────────────────────── Query Generation & Execution ────────────────────────

@flask_app.route("/api/workspaces/<int:workspace_id>/databases/<int:db_id>/generate",
                 methods=["POST"])
@login_required
def generate(workspace_id, db_id):
    body = request.get_json(silent=True) or {}
    prompt = (body.get("prompt") or "").strip()
    if not prompt:
        return err("Field 'prompt' is required.")
    if len(prompt) > Config.MAX_PROMPT_LENGTH:
        return err(f"Prompt exceeds maximum length of {Config.MAX_PROMPT_LENGTH}.")

    u = g.current_user
    role = db_role(db_id, u["id"])
    if not role and not u.get("is_platform_admin"):
        return err("You do not currently have access to this database.", 403,
                   code="NO_DB_ACCESS")
    if u.get("is_platform_admin") and not role:
        role = "admin"

    rec = dbc.get_db_with_creds(db_id)
    if not rec:
        return err("Database not found.", 404)

    schema_cache = rec.get("schema_cache") or []
    visible = dbc.filter_schema_for_user(schema_cache, db_id, u["id"])
    allowed_ops = ROLE_QUERY_PERMISSIONS.get(role, set())

    overall_start = time.perf_counter()

    # 1. Translate
    sql_start = time.perf_counter()
    try:
        sql, llm_mode = llm_svc.translate(prompt, visible, allowed_ops)
    except Exception as exc:
        return err(f"LLM translation failed: {exc}", 500)
    sql_ms = int((time.perf_counter() - sql_start) * 1000)

    # 2. Validate / classify
    classification = classify(sql)
    op = _query_op_to_required(classification.op)

    # 3. Enforce RBAC at backend
    if not role_allows(role, op):
        msg = (f"Your current role ('{role}') does not permit '{op}' operations on this database."
               f" Allowed: {sorted(list(allowed_ops))}.")
        audit.log_event(action="query", workspace_id=workspace_id, db_id=db_id,
                        user_id=u["id"], query_type=op,
                        natural_prompt=prompt, generated_sql=sql,
                        execution_ms=0, row_count=0, success=False,
                        error_message=msg, metadata={"reason": "permission_denied"})
        return err(msg, 403, code="PERMISSION_DENIED",
                   classification=classify_dict(classification), sql=sql, role=role,
                   allowed=sorted(list(allowed_ops)))

    # 4. High-risk requires admin approval
    if classification.is_high_risk and role != "admin":
        # Persist approval request
        with db_connection() as conn:
            with dict_cursor(conn) as cur:
                cur.execute(
                    "INSERT INTO query_approvals "
                    "(workspace_id, db_id, user_id, natural_prompt, generated_sql, "
                    " query_type, risk_reasons) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s::jsonb) RETURNING *;",
                    (workspace_id, db_id, u["id"], prompt, sql, op,
                     pgx.Json(classification.reasons)),
                )
                ap = cur.fetchone()
        audit.log_event(action="query", workspace_id=workspace_id, db_id=db_id,
                        user_id=u["id"], query_type=op,
                        natural_prompt=prompt, generated_sql=sql,
                        execution_ms=sql_ms, row_count=0, success=False,
                        error_message="High-risk query pending approval",
                        metadata={"approval_id": ap["id"],
                                  "reasons": classification.reasons})
        return err("This is a high-risk query and requires admin approval.",
                   202, code="APPROVAL_REQUIRED", approval=dict(ap),
                   classification=classify_dict(classification), sql=sql)

    # 5. Execute on external db
    exec_start = time.perf_counter()
    columns, rows, row_count, exec_error = [], [], 0, None
    try:
        conn = dbc._connect_external(
            rec["host"], rec["port"], rec["database_name"],
            rec["db_username"], rec["password"],
            rec.get("sslmode") or "disable",
        )
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(sql.rstrip(";"))
            if cur.description:
                columns = [d[0] for d in cur.description]
                raw = cur.fetchmany(500)
                rows = _serialize_rows(columns, [dict(zip(columns, r)) for r in raw])
                row_count = len(rows)
            else:
                row_count = cur.rowcount if cur.rowcount is not None else 0
        conn.close()
    except Exception as exc:
        exec_error = str(exc)

    exec_ms = int((time.perf_counter() - exec_start) * 1000)
    total_ms = int((time.perf_counter() - overall_start) * 1000)
    tokens = llm_svc.count_tokens(prompt, sql)
    _ = exec_ms  # kept for future per-step metric reporting

    success = exec_error is None
    # 6. Persist history & audit
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                "INSERT INTO query_history "
                "(workspace_id, db_id, user_id, natural_prompt, generated_sql, "
                " query_type, row_count, execution_ms, success, summary) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb) RETURNING id;",
                (workspace_id, db_id, u["id"], prompt, sql, op, row_count,
                 total_ms, success,
                 pgx.Json({"columns": columns, "preview_rows": rows[:5]})),
            )
            hist = cur.fetchone()

    audit.log_event(action="query", workspace_id=workspace_id, db_id=db_id,
                    user_id=u["id"], query_type=op,
                    natural_prompt=prompt, generated_sql=sql,
                    execution_ms=total_ms, row_count=row_count,
                    success=success, error_message=exec_error,
                    metadata={"llm_mode": llm_mode, "tokens": tokens,
                              "high_risk": classification.is_high_risk,
                              "reasons": classification.reasons})

    if not success:
        return err(f"Query execution failed: {exec_error}", 400,
                   sql=sql, classification=classify_dict(classification),
                   latency=f"{total_ms}ms", llm_mode=llm_mode)

    return ok({
        "sql": sql,
        "columns": columns,
        "rows": rows,
        "latency": f"{total_ms}ms",
        "tokensUsed": tokens,
        "database": rec["name"],
        "llm_mode": llm_mode,
        "classification": classify_dict(classification),
        "history_id": hist["id"],
        "rowCount": row_count,
    })


# ─────────────────────── High-risk Approvals ────────────────────────────────

@flask_app.route("/api/workspaces/<int:workspace_id>/approvals", methods=["GET"])
@login_required
@require_workspace_admin
def list_approvals(workspace_id):
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                "SELECT a.*, u.name AS user_name, u.email AS user_email, "
                "d.name AS db_name "
                "FROM query_approvals a "
                "LEFT JOIN auth_users u ON u.id=a.user_id "
                "LEFT JOIN db_connections d ON d.id=a.db_id "
                "WHERE a.workspace_id=%s ORDER BY a.created_at DESC;",
                (workspace_id,),
            )
            rows = [dict(r) for r in cur.fetchall()]
    return ok({"approvals": rows})


@flask_app.route("/api/workspaces/<int:workspace_id>/approvals/<int:ap_id>/approve",
                 methods=["POST"])
@login_required
@require_workspace_admin
def approve_query(workspace_id, ap_id):
    """Approve & execute the previously-flagged query."""
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute("SELECT * FROM query_approvals WHERE id=%s AND workspace_id=%s;",
                        (ap_id, workspace_id))
            ap = cur.fetchone()
            if not ap:
                return err("Approval not found.", 404)
            if ap["status"] != "pending":
                return err(f"Approval already {ap['status']}.", 400)
    rec = dbc.get_db_with_creds(ap["db_id"])
    if not rec:
        return err("Database missing.", 404)

    # Execute
    columns, rows, row_count, exec_error = [], [], 0, None
    start = time.perf_counter()
    try:
        conn = dbc._connect_external(
            rec["host"], rec["port"], rec["database_name"],
            rec["db_username"], rec["password"],
            rec.get("sslmode") or "disable",
        )
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(ap["generated_sql"].rstrip(";"))
            if cur.description:
                columns = [d[0] for d in cur.description]
                raw = cur.fetchmany(500)
                rows = _serialize_rows(columns, [dict(zip(columns, r)) for r in raw])
                row_count = len(rows)
            else:
                row_count = cur.rowcount or 0
        conn.close()
    except Exception as exc:
        exec_error = str(exc)

    ms = int((time.perf_counter() - start) * 1000)
    success = exec_error is None
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                "UPDATE query_approvals SET status=%s, reviewer_id=%s, reviewed_at=NOW() "
                "WHERE id=%s RETURNING *;",
                ("approved" if success else "rejected", g.current_user["id"], ap_id),
            )
            updated = cur.fetchone()

    audit.log_event(action="approve_query", workspace_id=workspace_id,
                    db_id=ap["db_id"], user_id=g.current_user["id"],
                    query_type=ap["query_type"],
                    natural_prompt=ap["natural_prompt"], generated_sql=ap["generated_sql"],
                    execution_ms=ms, row_count=row_count, success=success,
                    error_message=exec_error, metadata={"approval_id": ap_id})
    if not success:
        return err(f"Execution failed: {exec_error}", 400,
                   approval=dict(updated))
    return ok({"approval": dict(updated), "columns": columns, "rows": rows,
               "rowCount": row_count, "latency": f"{ms}ms"})


@flask_app.route("/api/workspaces/<int:workspace_id>/approvals/<int:ap_id>/reject",
                 methods=["POST"])
@login_required
@require_workspace_admin
def reject_query(workspace_id, ap_id):
    body = request.get_json(silent=True) or {}
    permanent = bool(body.get("block_pattern"))
    new_status = "blocked" if permanent else "rejected"
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                "UPDATE query_approvals SET status=%s, reviewer_id=%s, reviewed_at=NOW() "
                "WHERE id=%s AND workspace_id=%s RETURNING *;",
                (new_status, g.current_user["id"], ap_id, workspace_id),
            )
            row = cur.fetchone()
    if not row:
        return err("Approval not found.", 404)
    audit.log_event(action="reject_query", workspace_id=workspace_id,
                    db_id=row["db_id"], user_id=g.current_user["id"],
                    natural_prompt=row["natural_prompt"],
                    generated_sql=row["generated_sql"], success=True,
                    metadata={"approval_id": ap_id, "permanent": permanent})
    return ok({"approval": dict(row)})


# ─────────────────────── Audit & Analytics ──────────────────────────────────

@flask_app.route("/api/workspaces/<int:workspace_id>/audit", methods=["GET"])
@login_required
@require_workspace_admin
def workspace_audit(workspace_id):
    rows = audit.list_logs(
        workspace_id=workspace_id,
        db_id=request.args.get("db_id", type=int),
        user_id=request.args.get("user_id", type=int),
        query_type=request.args.get("query_type"),
        start=request.args.get("start"),
        end=request.args.get("end"),
        limit=request.args.get("limit", default=200, type=int),
        offset=request.args.get("offset", default=0, type=int),
    )
    return ok({"logs": rows})


@flask_app.route("/api/workspaces/<int:workspace_id>/analytics/overview", methods=["GET"])
@login_required
@require_workspace_admin
def analytics_overview(workspace_id):
    return ok({
        "overview": analytics.workspace_overview(workspace_id),
        "queries_per_day": analytics.queries_per_day(workspace_id),
        "top_databases": analytics.top_databases(workspace_id),
        "top_users": analytics.top_users(workspace_id),
    })


# ─────────────────────── Query History ──────────────────────────────────────

@flask_app.route("/api/history", methods=["GET"])
@login_required
def history():
    u = g.current_user
    q = (request.args.get("q") or "").strip().lower()
    fav = request.args.get("favorite")
    where = ["user_id=%s"]
    args = [u["id"]]
    if q:
        where.append("(LOWER(natural_prompt) LIKE %s OR LOWER(generated_sql) LIKE %s)")
        args.extend([f"%{q}%", f"%{q}%"])
    if fav == "1":
        where.append("is_favorite=TRUE")
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                f"""
                SELECT h.*, d.name AS db_name
                FROM query_history h
                LEFT JOIN db_connections d ON d.id=h.db_id
                WHERE {' AND '.join(where)}
                ORDER BY h.created_at DESC LIMIT 200;
                """, args,
            )
            rows = [dict(r) for r in cur.fetchall()]
    for r in rows:
        if r.get("created_at"):
            r["created_at"] = r["created_at"].isoformat()
    return ok({"history": rows})


@flask_app.route("/api/history/<int:hist_id>/favorite", methods=["POST"])
@login_required
def toggle_favorite(hist_id):
    u = g.current_user
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                "UPDATE query_history SET is_favorite = NOT is_favorite "
                "WHERE id=%s AND user_id=%s RETURNING *;",
                (hist_id, u["id"]),
            )
            row = cur.fetchone()
    if not row:
        return err("Not found.", 404)
    return ok({"history": dict(row)})


@flask_app.route("/api/history/<int:hist_id>", methods=["DELETE"])
@login_required
def delete_history(hist_id):
    u = g.current_user
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM query_history WHERE id=%s AND user_id=%s;",
                        (hist_id, u["id"]))
            removed = cur.rowcount > 0
    return ok({"removed": removed})


# ─────────────────────── Admin Helpers ──────────────────────────────────────

@flask_app.route("/api/users/search", methods=["GET"])
@login_required
def search_users():
    q = (request.args.get("q") or "").strip().lower()
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                "SELECT id, name, email FROM auth_users "
                "WHERE LOWER(email) LIKE %s OR LOWER(name) LIKE %s "
                "ORDER BY name LIMIT 25;",
                (f"%{q}%", f"%{q}%"),
            )
            rows = [dict(r) for r in cur.fetchall()]
    return ok({"users": rows})


# ─────────────────────── Legacy /api/generate (back-compat) ─────────────────

@flask_app.route("/api/generate", methods=["POST"])
@login_required
def legacy_generate():
    """Backward compatible single-DB generate — uses the user's first accessible DB."""
    body = request.get_json(silent=True) or {}
    prompt = (body.get("prompt") or "").strip()
    if not prompt:
        return err("Field 'prompt' is required.")
    u = g.current_user
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                "SELECT d.id, d.workspace_id FROM db_connections d "
                "LEFT JOIN db_permissions p ON p.db_id=d.id AND p.user_id=%s "
                "JOIN workspaces w ON w.id=d.workspace_id "
                "LEFT JOIN workspace_members wm ON wm.workspace_id=w.id AND wm.user_id=%s "
                "WHERE (p.role IS NOT NULL OR w.owner_id=%s OR wm.role='admin') "
                "ORDER BY d.created_at LIMIT 1;",
                (u["id"], u["id"], u["id"]),
            )
            r = cur.fetchone()
    if not r:
        return err("No accessible database. Request access via the dashboard.", 403,
                   code="NO_DB_ACCESS")
    request.view_args = {}  # not used
    # Delegate to new endpoint
    body["prompt"] = prompt
    # we don't have a Flask test_client here; just re-implement minimal flow
    return generate(r["workspace_id"], r["id"])


# ─────────────────────── ASGI export ────────────────────────────────────────

app = WsgiToAsgi(flask_app)
