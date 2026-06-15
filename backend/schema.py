"""
QueryBridge – Enterprise Meta Schema (workspaces, RBAC, audit, etc.)
Backward compatible with original `auth_users` table.
"""
import logging
from db import db_connection

logger = logging.getLogger(__name__)

SCHEMA_SQL = """
-- ─── Auth (legacy table retained) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(200) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Workspaces ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspaces (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(180) NOT NULL,
    slug        VARCHAR(120) UNIQUE NOT NULL,
    description TEXT,
    owner_id    INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- workspace_members(role): admin | viewer | analyst | editor
CREATE TABLE IF NOT EXISTS workspace_members (
    id           SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    role         VARCHAR(20) NOT NULL DEFAULT 'viewer',
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- ─── Registered External Databases ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS db_connections (
    id             SERIAL PRIMARY KEY,
    workspace_id   INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name           VARCHAR(160) NOT NULL,
    db_type        VARCHAR(40) NOT NULL DEFAULT 'postgresql',
    host           VARCHAR(255) NOT NULL,
    port           INTEGER NOT NULL DEFAULT 5432,
    database_name  VARCHAR(160) NOT NULL,
    db_username    VARCHAR(120) NOT NULL,
    db_password_enc TEXT NOT NULL,
    sslmode        VARCHAR(40) DEFAULT 'disable',
    description    TEXT,
    schema_cache   JSONB,
    schema_synced_at TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Database-level Permissions ──────────────────────────────────────────────
-- A user can have a per-database role overriding workspace role.
CREATE TABLE IF NOT EXISTS db_permissions (
    id             SERIAL PRIMARY KEY,
    db_id          INTEGER NOT NULL REFERENCES db_connections(id) ON DELETE CASCADE,
    user_id        INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    role           VARCHAR(20) NOT NULL DEFAULT 'viewer',
    granted_by     INTEGER REFERENCES auth_users(id),
    granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(db_id, user_id)
);

-- ─── Table-level Permissions ─────────────────────────────────────────────────
-- mode = 'allowed' | 'restricted'.  When mode='allowed' only listed tables
-- are visible to the user; when 'restricted' the listed tables are hidden.
CREATE TABLE IF NOT EXISTS table_permissions (
    id             SERIAL PRIMARY KEY,
    db_id          INTEGER NOT NULL REFERENCES db_connections(id) ON DELETE CASCADE,
    user_id        INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    mode           VARCHAR(20) NOT NULL DEFAULT 'restricted',
    tables         JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(db_id, user_id)
);

-- ─── Access Requests ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_requests (
    id             SERIAL PRIMARY KEY,
    workspace_id   INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    db_id          INTEGER NOT NULL REFERENCES db_connections(id) ON DELETE CASCADE,
    user_id        INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    requested_role VARCHAR(20) NOT NULL DEFAULT 'viewer',
    reason         TEXT,
    status         VARCHAR(20) NOT NULL DEFAULT 'pending',   -- pending|approved|rejected|revoked
    reviewer_id    INTEGER REFERENCES auth_users(id),
    reviewed_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Audit Log ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id             SERIAL PRIMARY KEY,
    workspace_id   INTEGER REFERENCES workspaces(id) ON DELETE SET NULL,
    db_id          INTEGER REFERENCES db_connections(id) ON DELETE SET NULL,
    user_id        INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
    action         VARCHAR(60) NOT NULL,         -- query | login | grant | revoke | request_access | approve | reject
    query_type     VARCHAR(20),                  -- SELECT | INSERT | ...
    natural_prompt TEXT,
    generated_sql  TEXT,
    execution_ms   INTEGER,
    row_count      INTEGER,
    success        BOOLEAN,
    error_message  TEXT,
    metadata       JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_db ON audit_logs(db_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

-- ─── Query History (per user, per execution) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS query_history (
    id             SERIAL PRIMARY KEY,
    workspace_id   INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
    db_id          INTEGER REFERENCES db_connections(id) ON DELETE CASCADE,
    user_id        INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    natural_prompt TEXT NOT NULL,
    generated_sql  TEXT NOT NULL,
    query_type     VARCHAR(20),
    row_count      INTEGER,
    execution_ms   INTEGER,
    success        BOOLEAN NOT NULL DEFAULT TRUE,
    is_favorite    BOOLEAN NOT NULL DEFAULT FALSE,
    summary        JSONB,                  -- {columns:[...], preview_rows:[...]}
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_history_user ON query_history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_created ON query_history(created_at DESC);

-- ─── High-Risk Query Approval ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS query_approvals (
    id             SERIAL PRIMARY KEY,
    workspace_id   INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    db_id          INTEGER NOT NULL REFERENCES db_connections(id) ON DELETE CASCADE,
    user_id        INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    natural_prompt TEXT,
    generated_sql  TEXT NOT NULL,
    query_type     VARCHAR(20),
    risk_reasons   JSONB,
    status         VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|approved|rejected|blocked
    reviewer_id    INTEGER REFERENCES auth_users(id),
    reviewed_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


def init_schema() -> None:
    """Create all enterprise tables if missing (idempotent)."""
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(SCHEMA_SQL)
            # Defensive: ensure new columns exist on legacy DBs
            cur.execute("""
                ALTER TABLE auth_users
                ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE;
            """)
    logger.info("QueryBridge schema initialized.")
