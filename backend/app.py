"""
QueryBridge - Flask API Gateway
Natural Language → SQL Translation Engine

Endpoints:
  POST /api/generate   → translate prompt to SQL & execute
  POST /api/auth/register → create an authenticated user account
  POST /api/auth/login    → exchange credentials for a bearer token
  GET  /api/auth/me       → return the current bearer-token user
  GET  /api/health     → service status check
  GET  /api/schema     → expose live DB table metadata
"""

import time
import logging
import psycopg2
from flask import Flask, jsonify, request
from flask_cors import CORS
from workspace import (
    create_workspace,
    list_workspaces_for_user,
)
from database_connections import (
    test_connection,
    create_db,
    list_dbs_for_workspace,
)
from auth import login_required
from flask import g, request

from auth import authenticate_user, create_token, create_user, get_current_user, login_required
from config import Config
from db import db_connection
# fetch_schema_info, init_auth_schema
# from llm import translate_to_sql, count_tokens
from llm import translate, count_tokens

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config.from_object(Config)

CORS(app, resources={r"/api/*": {"origins": Config.CORS_ORIGINS}})


# try:
#     init_auth_schema()
# except Exception as exc:
#     logger.warning("Auth schema initialization skipped: %s", exc)


def success_response(data: dict, status: int = 200):
    return jsonify({"status": "ok", **data}), status


def error_response(message: str, status: int = 400):
    return jsonify({"status": "error", "message": message}), status


def _auth_payload(user: dict, status: int = 200):
    return success_response({"user": user, "token": create_token(user)}, status)
@app.route("/api/workspaces", methods=["GET"])
@login_required
def get_workspaces():
    user = g.current_user

    workspaces = list_workspaces_for_user(
        user["id"],
        user.get("is_platform_admin", False)
    )

    return jsonify({
        "success": True,
        "workspaces": workspaces
    })


@app.route("/api/workspaces", methods=["POST"])
@login_required
def create_workspace_route():

    body = request.get_json() or {}

    name = body.get("name")
    description = body.get("description", "")

    if not name:
        return jsonify({
            "success": False,
            "message": "Workspace name required"
        }), 400

    ws = create_workspace(
        name=name,
        description=description,
        owner_id=g.current_user["id"]
    )

    return jsonify({
        "success": True,
        "workspace": ws
    }), 201
@app.route("/api/workspaces/<int:workspace_id>/databases/test", methods=["POST"])
@login_required
def test_database(workspace_id):
    body = request.get_json() or {}

    ok, message = test_connection(
        host=body.get("host"),
        port=body.get("port"),
        database=body.get("database_name"),
        user=body.get("username"),
        password=body.get("password"),
        db_type=body.get("db_type", "postgresql"),
        sslmode=body.get("sslmode", "disable"),
    )

    return jsonify({
        "success": ok,
        "message": message
    })
@app.route("/api/workspaces/<int:workspace_id>/databases", methods=["POST"])
@login_required
def register_database(workspace_id):

    body = request.get_json() or {}

    db = create_db(
    workspace_id=workspace_id,
    name=body.get("name"),
    db_type=body.get("db_type"),
    host=body.get("host"),
    port=body.get("port"),
    database_name=body.get("database_name"),
    username=body.get("db_username"),
    password=body.get("db_password"),
    sslmode=body.get("sslmode"),
    description=body.get("description"),
)

    return jsonify({
        "success": True,
        "database": db
    }), 201
@app.route("/api/workspaces/<int:workspace_id>/databases", methods=["GET"])
@login_required
def get_workspace_databases(workspace_id):

    dbs = list_dbs_for_workspace(workspace_id)

    return jsonify({
        "success": True,
        "databases": dbs
    })
    


@app.route("/api/auth/register", methods=["POST"])
def register():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if len(name) < 2:
        return error_response("Name must be at least 2 characters.")
    if "@" not in email or "." not in email:
        return error_response("A valid email address is required.")
    if len(password) < 8:
        return error_response("Password must be at least 8 characters.")

    try:
        user = create_user(name, email, password)
        return _auth_payload(user, 201)
    except psycopg2.errors.UniqueViolation:
        return error_response("An account with this email already exists.", 409)
    except Exception as exc:
        logger.error("Registration failed: %s", exc, exc_info=True)
        return error_response(f"Registration failed: {exc}", 500)


@app.route("/api/auth/login", methods=["POST"])
def login():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not email or not password:
        return error_response("Email and password are required.")

    try:
        user = authenticate_user(email, password)
        if not user:
            return error_response("Invalid email or password.", 401)
        return _auth_payload(user)
    except Exception as exc:
        logger.error("Login failed: %s", exc, exc_info=True)
        return error_response(f"Login failed: {exc}", 500)


@app.route("/api/auth/me", methods=["GET"])
def me():
    user = get_current_user()
    if not user:
        return error_response("Authentication required.", 401)
    return success_response({"user": user})


@app.route("/api/health", methods=["GET"])
def health():
    """
    Health-check endpoint.
    The React frontend pings this to decide whether to show LIVE CORE or
    Quantum Simulation mode in the Navbar status badge.

    Returns 200 with service info when everything is reachable.
    """
    db_ok = False
    db_error = None
    try:
        with db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
            db_ok = True
    except Exception as exc:
        db_error = str(exc)
        logger.warning("Health check – DB unreachable: %s", exc)

    return success_response({
        "service": "QueryBridge API",
        "version": "1.0.0",
        "llm_model": Config.OLLAMA_MODEL,
        "database": "PostgreSQL" if db_ok else "unavailable",
        "db_connected": db_ok,
        "db_error": db_error,
    })


# @app.route("/api/schema", methods=["GET"])
# @login_required
# def schema():
#     """
#     Returns live table metadata (name, row count, column list) from the
#     connected PostgreSQL database. The frontend Schema Sidebar can call
#     this to show real counts instead of the hard-coded mock values.
#     """
#     try:
#         with db_connection() as conn:
#             tables = fetch_schema_info(conn)
#         return success_response({"tables": tables})
#     except Exception as exc:
#         logger.error("Schema fetch failed: %s", exc)
#         return error_response(f"Schema fetch failed: {exc}", 500)

@app.route("/api/roles", methods=["GET"])
def roles():
    return jsonify({
        "status": "ok",
        "roles": [
            {
                "id": "platform_admin",
                "name": "Platform Admin"
            },
            {
                "id": "workspace_admin",
                "name": "Workspace Admin"
            },
            {
                "id": "editor",
                "name": "Editor"
            },
            {
                "id": "viewer",
                "name": "Viewer"
            }
        ]
    })


@app.route("/api/generate", methods=["POST"])
@login_required
def generate():
    """
    Core translation endpoint.

    Request body (JSON):
        { "prompt": "Show CSE students from NIT Agartala with CGPA above 8.5" }

    Response body (JSON):
        {
          "status":     "ok",
          "sql":        "SELECT ...",
          "columns":    ["id", "name", ...],
          "rows":       [{...}, ...],
          "latency":    "312ms",
          "tokensUsed": 345,
          "database":   "PostgreSQL 16 (Ollama llama3)"
        }

    The frontend (src/services/api.js → generateSqlQuery) maps these fields
    directly onto the queryResult state object.
    """
    body = request.get_json(silent=True) or {}
    prompt = (body.get("prompt") or "").strip()

    if not prompt:
        return error_response("Field 'prompt' is required and must not be empty.")

    if len(prompt) > Config.MAX_PROMPT_LENGTH:
        return error_response(
            f"Prompt exceeds maximum length of {Config.MAX_PROMPT_LENGTH} characters."
        )

    logger.info("Received prompt: %s", prompt)
    overall_start = time.perf_counter()

    try:
        sql_start = time.perf_counter()
        # sql_query = translate_to_sql(prompt)
        sql_query, mode = translate(
            prompt,
            [{"name": "auth_users", "columns": []}],
            {"SELECT"}
)
        sql_elapsed = time.perf_counter() - sql_start

        logger.info("Generated SQL (%.0fms): %s", sql_elapsed * 1000, sql_query)

        with db_connection() as conn:
            with conn.cursor() as cur:
                exec_start = time.perf_counter()
                cur.execute(sql_query)
                exec_elapsed = time.perf_counter() - exec_start

                columns = [desc[0] for desc in cur.description] if cur.description else []

                raw_rows = cur.fetchall()
                rows = [dict(zip(columns, row)) for row in raw_rows]

        logger.info(
            "Query executed in %.0fms – returned %d rows", exec_elapsed * 1000, len(rows)
        )

        total_latency_ms = int((time.perf_counter() - overall_start) * 1000)
        tokens_used = count_tokens(prompt, sql_query)

        return success_response({
            "sql":        sql_query,
            "columns":    columns,
            "rows":       rows,
            "latency":    f"{total_latency_ms}ms",
            "tokensUsed": tokens_used,
            "database":   f"PostgreSQL {Config.PG_VERSION} (Ollama {Config.OLLAMA_MODEL})",
        })

    except ValueError as exc:
        # Raised by llm.py when Ollama returns something that isn't valid SQL
        logger.warning("SQL translation error: %s", exc)
        return error_response(str(exc), 422)

    except Exception as exc:
        logger.error("Unhandled error in /api/generate: %s", exc, exc_info=True)
        return error_response(f"Server error: {exc}", 500)
@app.route(
    "/api/workspaces/<int:workspace_id>/access-requests",
    methods=["POST"]
)
# @login_required
# def create_access_request(workspace_id):
#     pass
# @app.route(
#     "/api/workspaces/<int:workspace_id>/databases/<int:database_id>/schema",
#     methods=["GET"]
# )
# @login_required
# def get_schema(workspace_id, database_id):
#     pass
@app.route(
    "/api/workspaces/<int:workspace_id>/databases/<int:database_id>/generate",
    methods=["POST"]
)
@login_required
def generate_query(workspace_id, database_id):
    pass

if __name__ == "__main__":
    logger.info(
        "Starting QueryBridge API on %s:%s (debug=%s)",
        Config.HOST,
        Config.PORT,
        Config.DEBUG,
    )
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
