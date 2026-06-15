# QueryBridge Enterprise Access Management – PRD

## Original Problem Statement
Transform QueryBridge (React + Flask + PostgreSQL + Ollama AI SQL gateway) from a single-user tool into a multi-tenant enterprise platform with workspaces, RBAC, database governance, access requests, high-risk approval workflow, full audit trail, query history and admin analytics — without disturbing the existing stack or aesthetic.

## Architecture
- **Frontend** : React 19 + Vite + Tailwind v4 + Framer Motion (kept the original neon-cyan / neon-purple cybernetic aesthetic, dark+light themes, FloatingBackground starfield).
- **Backend**  : Flask 3 wrapped as ASGI via `asgiref.wsgi.WsgiToAsgi`, served by uvicorn at `:8001`. Modules: `auth.py`, `permissions.py`, `workspace.py`, `database_connections.py`, `query_validation.py`, `audit.py`, `analytics.py`, `llm.py`, `seed.py`, `schema.py`, `crypto_utils.py`.
- **Meta DB**  : PostgreSQL 15 (local, supervisor-managed) holding workspaces, members, db_connections (Fernet-encrypted credentials), db_permissions, table_permissions, access_requests, query_history, query_approvals, audit_logs.
- **AI layer** : Ollama-first translation with rule-based fallback; per-request role-aware schema and allowed-ops are injected into the system prompt.
- **External demo DB** : `company_db` (employees, departments, salaries, payroll) auto-seeded into local Postgres and auto-registered into the bootstrap workspace.

## User Personas
- **Platform Admin** – manages every workspace.
- **Workspace Admin** – manages members/databases/access/audit within their workspace.
- **Analyst / Editor / Viewer** – work inside the query workspace under role limits.

## Implemented (2026-06-12)
P0 features:
- Workspaces with member roles (viewer/analyst/editor/admin)
- Admin Dashboard with tabs (Overview, Members, Databases, Access Requests, Query Approvals, Audit)
- Database Registration: Add / Test / Update / Delete / Refresh-schema; credentials Fernet-encrypted at rest
- Access Request workflow (request → admin approve/reject → grants db_permission)
- RBAC enforced both in UI (visibility / disabled actions) and in backend before SQL execution
- AI Query Permission Validation (sqlglot classification → role-allowed ops)
- High-Risk Query Approval (DROP / DELETE-without-WHERE / TRUNCATE / DDL flagged → admin-only approval)
- Audit Logging with filter + CSV export
- Database-level Permissions
- Table-level Permissions (restricted/allowed) applied to AI schema context
- Query History (per user, server-stored), search, favorite, delete, rerun
- Enterprise Analytics Dashboard (totals + queries-per-day chart + top dbs/users)

## Test Credentials
See `/app/memory/test_credentials.md`.

## Backlog / Next Items
P1:
- Mobile-responsive Admin tables (currently scroll horizontally)
- Email notifications on access-request decisions (no SMTP wired)
- MySQL connector (architecture ready, driver not added yet)
- Granular table-level permission UI inside Admin > Databases

P2:
- Saved query templates per workspace
- "Block pattern permanently" actually enforces a deny-list on future generates
- Workspace-level usage quotas

## Enhancement Idea
SaaS-style monetisation: gate "create workspace #3+" or "register database #5+" behind a paid tier and add a Stripe-backed upgrade modal next to the workspace switcher — multi-tenant data tools convert extremely well on usage caps.
