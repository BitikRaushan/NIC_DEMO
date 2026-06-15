# QueryBridge : Flask Backend

> **AI-Powered Natural Language → SQL Engine**

## Architecture

```
React Frontend
    │  POST /api/generate  {prompt}
    ▼
Flask API  (app.py)
    │
    ├─► llm.py  ──►  Ollama /api/chat  ──►  returns SQL string
    │
    └─► db.py   ──► PostgreSQL ──►  returns rows as JSON
```

---

## File Structure

```
querybridge-backend/
├── app.py          ← Flask routes & entry point
├── config.py       ← All env-var-driven settings
├── db.py           ← PostgreSQL pool, schema introspection, seeder
├── llm.py          ← Ollama prompt engineering + SQL validation
├── requirements.txt
├── .env.example    ← Copy to .env and fill in your values
└── README.md
```

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.10+ | Runtime |
| PostgreSQL | 16.x | Database |
| Ollama | Latest | Local LLM inference |

---

## Quick Start

### 1. Install Python dependencies

```bash
cd querybridge-backend
python -m venv venv
source venv/bin/activate      
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
```

### 3. Set up PostgreSQL

```sql
CREATE DATABASE querybridge;
```

Then seed the demo tables:

```bash
python db.py
```

### 4. Pull an Ollama model

```bash
ollama pull llama3         
# or
ollama pull qwen2.5-coder  
# or
ollama pull mistral     
```

### 5. Start Ollama

```bash
ollama serve
```

### 6. Start the Flask server

```bash

python -m uvicorn server:app --reload --port 8001
```

The server starts on `http://127.0.0.1:8001`.

---

## API Reference

### `GET /api/health`

Returns the operational status of the Flask service and its dependencies.
The React Navbar calls this to toggle between **LIVE CORE** and **Quantum Simulation** mode.

**Response 200**
```json
{
  "status": "ok",
  "service": "QueryBridge API",
  "version": "1.0.0",
  "llm_model": "llama3",
  "database": "PostgreSQL",
  "db_connected": true,
  "db_error": null
}
```

---

### `GET /api/schema`

Returns live table metadata from the connected database.
Useful for keeping the React Schema Sidebar in sync with real row counts.

**Response 200**
```json
{
  "status": "ok",
  "tables": [
    {
      "name": "users",
      "count": 188,
      "columns": ["id (PK)", "name", "email", "state", "created_at"]
    }
  ]
}
```

---

### `POST /api/generate`

Core endpoint. Translates a natural-language prompt into SQL, runs it,
and returns the results.

**Request body**
```json
{ "prompt": "Show all professors in the CSE department" }
```

**Response 200**
```json
{
  "status":     "ok",
  "sql":        "SELECT name, designation, email\nFROM professors\nJOIN departments ON departments.department_id = professors.department_id\nWHERE departments.code = 'CSE'\nORDER BY name ASC\nLIMIT 100;",
  "columns":    ["id", "name", "email", "state", "created_at"],
  "rows":       [{ "id": 1, "name": "Elena Rostova", ... }],
  "latency":    "312ms",
  "tokensUsed": 345,
  "database":   "PostgreSQL 16 (Ollama llama3)"
}
```

**Error responses**

| Status | When |
|--------|------|
| 400 | `prompt` field missing or empty |
| 422 | LLM returned invalid or unsafe SQL |
| 500 | Database or Ollama unreachable |

---

## Database Schema

```sql
users       (id PK, name, email, state CHAR(2), created_at DATE)
institutes  (institute_id PK, name, city)
departments (department_id PK, institute_id FK, name, code)
professors  (professor_id PK, department_id FK, name, designation)
students    (student_id PK, program_id FK, roll_no, name, cgpa)
courses     (course_id PK, department_id FK, course_code, title)
```

### Example prompts to test
professors in the CSE department
Find top 5 students in ME branch
Get average attendance for section A
List exams for this month
Get average revenue per month
List orders with status processing
Count users who registered in the last 7 days
```

---

## Safety Design

| Layer | Mechanism |
|-------|-----------|
| **Prompt** | System prompt instructs model: SELECT-only, no DDL/DML |
| **Regex validation** | `llm.py:_validate_sql()` rejects any non-SELECT first word |
| **Keyword blocklist** | `Config.BLOCKED_SQL_KEYWORDS` — DROP, DELETE, TRUNCATE, etc. |
| **Input length cap** | `MAX_PROMPT_LENGTH` (default 500 chars) prevents prompt injection |
| **Read-only intent** | `autocommit=True` — no implicit transaction open for mutation |

---

## Switching LLM Models

Set `OLLAMA_MODEL` in your `.env`:

```bash
OLLAMA_MODEL=qwen2.5-coder   # Best for SQL generation
OLLAMA_MODEL=llama3           # Best overall reasoning
OLLAMA_MODEL=mistral          # Fastest on CPU
```

No code changes needed — `config.py` and `llm.py` read the env var at startup.

---

## Connecting to the React Frontend

1. Start Flask on port 5000 (`python app.py`).
2. Open the QueryBridge React app in your browser.
3. Click the **Gear icon** (top-right Navbar).
4. Set the **AI Bridge Endpoint URL** to `http://localhost:5000/api`.
5. Click **Apply Configuration**.

The status badge in the Navbar will switch from *Quantum Simulation* to **LIVE CORE** once the frontend can reach `/api/health`.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Connection refused` on `/api/health` | Flask isn't running; run `python app.py` |
| `db_connected: false` | Check PG_HOST / PG_PASSWORD in `.env`; ensure PostgreSQL is running |
| Ollama timeout | Run `ollama serve`; try a smaller model (`mistral`) |
| SQL validation error | The model produced a non-SELECT statement; try rephrasing the prompt |
| CORS error in browser | Add your frontend origin to `CORS_ORIGINS` in `.env` |
