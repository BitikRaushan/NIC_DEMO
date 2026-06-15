"""
QueryBridge – Internal DB layer (psycopg2 pool against the QueryBridge meta DB).
Holds workspaces, users, RBAC, audit, registered external databases, etc.
"""
import logging
from contextlib import contextmanager
from typing import Iterator

import psycopg2
import psycopg2.extras
from psycopg2 import pool

from config import Config

logger = logging.getLogger(__name__)

_pool: pool.SimpleConnectionPool | None = None


def _get_pool() -> pool.SimpleConnectionPool:
    global _pool
    if _pool is None or _pool.closed:
        _pool = psycopg2.pool.SimpleConnectionPool(
            minconn=Config.PG_MIN_CONN,
            maxconn=Config.PG_MAX_CONN,
            host=Config.PG_HOST,
            port=Config.PG_PORT,
            dbname=Config.PG_DATABASE,
            user=Config.PG_USER,
            password=Config.PG_PASSWORD,
            sslmode=Config.PG_SSLMODE,
        )
        logger.info("QueryBridge meta-DB pool created → %s:%s/%s",
                    Config.PG_HOST, Config.PG_PORT, Config.PG_DATABASE)
    return _pool


@contextmanager
def db_connection() -> Iterator[psycopg2.extensions.connection]:
    conn = _get_pool().getconn()
    conn.autocommit = True
    try:
        yield conn
    finally:
        _get_pool().putconn(conn)


def dict_cursor(conn):
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
