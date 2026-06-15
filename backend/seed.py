"""
Seed: bootstrap default platform admin, demo workspace, demo external
'company_db' PostgreSQL database registered with employees/departments/salaries.
"""
import logging
import os
import psycopg2
from werkzeug.security import generate_password_hash

from config import Config
from db import db_connection, dict_cursor
import database_connections as dbc

logger = logging.getLogger(__name__)


ADMIN_EMAIL = "admin@querybridge.dev"
ADMIN_PASSWORD = "Admin@12345"
ADMIN_NAME = "Platform Admin"

ANALYST_EMAIL = "analyst@querybridge.dev"
ANALYST_PASSWORD = "Analyst@12345"
ANALYST_NAME = "Demo Analyst"

VIEWER_EMAIL = "viewer@querybridge.dev"
VIEWER_PASSWORD = "Viewer@12345"
VIEWER_NAME = "Demo Viewer"


def _ensure_user(name, email, password, is_platform_admin=False) -> int:
    pwd = generate_password_hash(password)
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute("SELECT id FROM auth_users WHERE email=%s;", (email,))
            row = cur.fetchone()
            if row:
                return row["id"]
            cur.execute(
                "INSERT INTO auth_users (name, email, password_hash, is_platform_admin) "
                "VALUES (%s,%s,%s,%s) RETURNING id;",
                (name, email, pwd, is_platform_admin),
            )
            return cur.fetchone()["id"]


def _ensure_workspace(name, slug, owner_id) -> int:
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute("SELECT id FROM workspaces WHERE slug=%s;", (slug,))
            row = cur.fetchone()
            if row:
                return row["id"]
            cur.execute(
                "INSERT INTO workspaces (name, slug, description, owner_id) "
                "VALUES (%s,%s,%s,%s) RETURNING id;",
                (name, slug, "Demo workspace bootstrapped by QueryBridge", owner_id),
            )
            ws_id = cur.fetchone()["id"]
            cur.execute(
                "INSERT INTO workspace_members (workspace_id, user_id, role) "
                "VALUES (%s,%s,'admin') ON CONFLICT DO NOTHING;",
                (ws_id, owner_id),
            )
            return ws_id


def _ensure_company_db_exists():
    """Create demo external db `company_db` inside same PG instance."""
    try:
        admin_conn = psycopg2.connect(
            host=Config.PG_HOST, port=Config.PG_PORT,
            dbname="postgres", user=Config.PG_USER, password=Config.PG_PASSWORD,
            sslmode=Config.PG_SSLMODE,
        )
        admin_conn.autocommit = True
        with admin_conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname='company_db';")
            if not cur.fetchone():
                cur.execute("CREATE DATABASE company_db;")
                logger.info("Created demo external DB company_db")
        admin_conn.close()
    except Exception as exc:
        logger.warning("Could not ensure company_db: %s", exc)

    # Seed tables
    try:
        conn = psycopg2.connect(
            host=Config.PG_HOST, port=Config.PG_PORT,
            dbname="company_db", user=Config.PG_USER, password=Config.PG_PASSWORD,
            sslmode=Config.PG_SSLMODE,
        )
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS departments (
                  id SERIAL PRIMARY KEY,
                  name VARCHAR(120) NOT NULL,
                  location VARCHAR(120)
                );
                CREATE TABLE IF NOT EXISTS employees (
                  id SERIAL PRIMARY KEY,
                  full_name VARCHAR(160) NOT NULL,
                  email VARCHAR(200) UNIQUE,
                  job_title VARCHAR(120),
                  department_id INTEGER REFERENCES departments(id),
                  hired_on DATE,
                  status VARCHAR(20) DEFAULT 'active'
                );
                CREATE TABLE IF NOT EXISTS salaries (
                  id SERIAL PRIMARY KEY,
                  employee_id INTEGER UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
                  base_salary NUMERIC(12,2) NOT NULL,
                  currency CHAR(3) DEFAULT 'USD',
                  effective_from DATE DEFAULT CURRENT_DATE
                );
                CREATE TABLE IF NOT EXISTS payroll (
                  id SERIAL PRIMARY KEY,
                  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
                  paid_on DATE NOT NULL,
                  amount NUMERIC(12,2) NOT NULL,
                  status VARCHAR(20) DEFAULT 'paid'
                );
            """)
            cur.execute("SELECT COUNT(*) FROM departments;")
            if cur.fetchone()[0] == 0:
                cur.execute("""
                  INSERT INTO departments (name, location) VALUES
                  ('Engineering','Bengaluru'),
                  ('Sales','New York'),
                  ('Marketing','London'),
                  ('Operations','Berlin'),
                  ('Finance','Singapore');
                """)
            cur.execute("SELECT COUNT(*) FROM employees;")
            if cur.fetchone()[0] == 0:
                cur.execute("""
                  INSERT INTO employees (full_name,email,job_title,department_id,hired_on,status) VALUES
                  ('Aarav Sharma','aarav@company.dev','Senior Engineer',1,'2022-04-15','active'),
                  ('Ishita Roy','ishita@company.dev','Data Scientist',1,'2023-09-01','active'),
                  ('Rohan Paul','rohan@company.dev','SDET',1,'2024-01-10','active'),
                  ('Meera Debbarma','meera@company.dev','Account Executive',2,'2021-06-20','active'),
                  ('Tanmoy Biswas','tanmoy@company.dev','BD Manager',2,'2020-11-12','active'),
                  ('Ananya Deb','ananya@company.dev','Brand Strategist',3,'2023-03-04','active'),
                  ('Arjun Tripathi','arjun@company.dev','Ops Lead',4,'2019-08-25','active'),
                  ('Trisha Mandal','trisha@company.dev','Financial Analyst',5,'2022-02-14','active'),
                  ('Moumita Pal','moumita@company.dev','Recruiter',4,'2024-05-19','active'),
                  ('Mitali Chakma','mitali@company.dev','Junior Engineer',1,'2025-02-11','active');
                """)
                cur.execute("""
                  INSERT INTO salaries (employee_id,base_salary,currency) VALUES
                  (1, 145000, 'USD'),(2, 132000,'USD'),(3, 89000,'USD'),
                  (4, 112000,'USD'),(5, 138000,'USD'),(6,  95000,'USD'),
                  (7, 121000,'USD'),(8, 108000,'USD'),(9,  78000,'USD'),
                  (10, 62000,'USD');
                """)
                cur.execute("""
                  INSERT INTO payroll (employee_id, paid_on, amount, status)
                  SELECT employee_id, CURRENT_DATE - INTERVAL '30 days', base_salary/12, 'paid'
                  FROM salaries;
                  INSERT INTO payroll (employee_id, paid_on, amount, status)
                  SELECT employee_id, CURRENT_DATE,                base_salary/12, 'paid'
                  FROM salaries;
                """)
        conn.close()
    except Exception as exc:
        logger.warning("company_db seed failed: %s", exc)


def _register_company_db(workspace_id: int) -> int | None:
    """Register the local company_db inside QueryBridge as a managed connection."""
    with db_connection() as conn:
        with dict_cursor(conn) as cur:
            cur.execute(
                "SELECT id FROM db_connections WHERE workspace_id=%s AND database_name='company_db';",
                (workspace_id,),
            )
            row = cur.fetchone()
            if row:
                # refresh schema cache
                try:
                    dbc.refresh_schema(row["id"])
                except Exception:
                    pass
                return row["id"]
    rec = dbc.create_db(
        workspace_id=workspace_id, name="Company DB (demo)",
        db_type="postgresql", host=Config.PG_HOST, port=Config.PG_PORT,
        database_name="company_db", username=Config.PG_USER,
        password=Config.PG_PASSWORD, sslmode=Config.PG_SSLMODE,
        description="Auto-seeded demo company database (employees, departments, salaries, payroll).",
    )
    try:
        dbc.refresh_schema(rec["id"])
    except Exception as exc:
        logger.warning("Initial schema refresh failed: %s", exc)
    return rec["id"]


def seed_demo():
    # admin / analyst / viewer
    admin_id = _ensure_user(ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, is_platform_admin=True)
    analyst_id = _ensure_user(ANALYST_NAME, ANALYST_EMAIL, ANALYST_PASSWORD)
    viewer_id = _ensure_user(VIEWER_NAME, VIEWER_EMAIL, VIEWER_PASSWORD)

    ws_id = _ensure_workspace("Acme Corp", "acme-corp", admin_id)

    # add demo users as members
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO workspace_members (workspace_id, user_id, role) "
                "VALUES (%s,%s,'analyst') ON CONFLICT DO NOTHING;",
                (ws_id, analyst_id),
            )
            cur.execute(
                "INSERT INTO workspace_members (workspace_id, user_id, role) "
                "VALUES (%s,%s,'viewer') ON CONFLICT DO NOTHING;",
                (ws_id, viewer_id),
            )

    _ensure_company_db_exists()
    db_id = _register_company_db(ws_id)

    # default grants on the demo DB
    if db_id:
        with db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO db_permissions (db_id, user_id, role, granted_by) "
                    "VALUES (%s,%s,'analyst',%s) ON CONFLICT (db_id, user_id) DO NOTHING;",
                    (db_id, analyst_id, admin_id),
                )
                # viewer intentionally not granted — to demo Access Request flow
                # but restrict viewer from salary/payroll if they ever get access
                cur.execute(
                    "INSERT INTO table_permissions (db_id, user_id, mode, tables) "
                    "VALUES (%s,%s,'restricted','[\"salaries\",\"payroll\"]'::jsonb) "
                    "ON CONFLICT (db_id, user_id) DO NOTHING;",
                    (db_id, viewer_id),
                )

    logger.info("Seed complete: admin=%s analyst=%s viewer=%s ws=%s db=%s",
                admin_id, analyst_id, viewer_id, ws_id, db_id)
