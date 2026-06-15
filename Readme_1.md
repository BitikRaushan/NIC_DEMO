# QueryBridge – Enterprise AI Data Intelligence Platform

## Overview

QueryBridge is an AI-powered enterprise data analytics platform that allows organizations to securely connect their databases, manage workspace access, and query data using natural language.

The platform combines:

* Database Governance
* Workspace Management
* Role-Based Access Control (RBAC)
* AI-Powered SQL Generation
* Query Execution
* Audit Logging
* Access Request Workflows

into a single collaborative environment.

---

# Problem Statement

Organizations often store valuable data inside multiple databases, but accessing and analyzing that data usually requires:

* SQL expertise
* Database access permissions
* Technical teams
* Manual reporting workflows

QueryBridge solves this problem by enabling users to ask questions in natural language while maintaining enterprise-grade security and governance controls.

---

# Project Goals

### Primary Objectives

* Connect external databases securely.
* Allow workspace-based collaboration.
* Provide controlled access to datasets.
* Generate SQL queries using AI.
* Execute queries safely.
* Visualize and analyze results.
* Maintain audit trails for governance.

---

# System Architecture

```text
User
 │
 ▼
Frontend (React + Vite)
 │
 ▼
FastAPI / Flask Backend
 │
 ├── Authentication Service
 ├── Workspace Service
 ├── Access Control Service
 ├── Database Connection Service
 ├── AI Query Engine
 ├── Audit Service
 │
 ▼
PostgreSQL (Meta Database)
 │
 ▼
Connected Enterprise Databases
(PostgreSQL / MySQL / etc.)
```

---

# Core Features

## 1. Authentication & Authorization

Features:

* User Registration
* User Login
* JWT Authentication
* Session Validation
* Platform Admin Support

Security:

* Password Hashing
* JWT Tokens
* Protected APIs

---

## 2. Workspace Management

Users can:

* Create Workspaces
* Join Workspaces
* Manage Workspace Members
* Collaborate within Teams

Example:

```text
Workspace:
Sales Analytics

Members:
- Admin
- Analysts
- Viewers
```

---

## 3. Database Registration

Workspace administrators can register databases:

Supported:

* PostgreSQL
* MySQL (planned)
* SQL Server (planned)

Configuration:

* Host
* Port
* Database Name
* Username
* Password
* SSL Mode

Features:

* Test Connection
* Save Connection
* Schema Discovery

---

## 4. Role-Based Access Control (RBAC)

### Platform Admin

Can:

* View all workspaces
* Manage platform users
* Monitor system

### Workspace Admin

Can:

* Manage workspace
* Register databases
* Approve requests
* Manage permissions

### Analyst

Can:

* Run queries
* View schema
* Access approved databases

### Viewer

Can:

* View approved data
* Read-only access

---

## 5. Access Request Workflow

User Flow:

```text
User
 ↓
Request Access
 ↓
Admin Reviews
 ↓
Approve / Reject
 ↓
Access Granted
```

Features:

* Request Tracking
* Approval Workflow
* Permission Assignment

---

## 6. Database Permission Management

Granular controls:

* Database Level Access
* Table Level Access
* Query Restrictions

Examples:

```text
Analyst:
Sales Table
Customers Table

Restricted:
Payroll Table
```

---

## 7. Schema Discovery

Automatically discovers:

* Tables
* Columns
* Data Types
* Primary Keys
* Foreign Keys

Used by:

* AI Query Engine
* Governance Controls
* Query Validation

---

## 8. AI Query Generation

Powered by:

* Ollama
* Qwen Model

Workflow:

```text
Natural Language
 ↓
AI Translation
 ↓
SQL Query
 ↓
Validation
 ↓
Execution
 ↓
Results
```

Example:

Question:

```text
Show all employees
```

Generated SQL:

```sql
SELECT * FROM employees LIMIT 100;
```

---

## 9. Query Execution Engine

Features:

* Safe SQL Execution
* Role Validation
* Query Restrictions
* Result Formatting

Supported Operations:

* SELECT
* INSERT
* UPDATE
* DELETE (permission controlled)

---

## 10. Query Approval System

For sensitive operations:

```text
User Query
 ↓
Approval Required
 ↓
Admin Review
 ↓
Approve / Reject
```

Ensures enterprise governance.

---

## 11. Audit Logging

Tracks:

* Logins
* Database Access
* Query Execution
* Permission Changes
* Access Approvals

Benefits:

* Security
* Compliance
* Monitoring

---

# Technology Stack

## Frontend

* React
* Vite
* TypeScript
* Tailwind CSS
* Axios

---

## Backend

* Python
* Flask
* FastAPI Compatible APIs
* JWT Authentication
* SQLGlot

---

## Database

### Metadata Database

PostgreSQL

Stores:

* Users
* Workspaces
* Permissions
* Audit Logs
* Query History

### External Databases

* PostgreSQL

Future:

* MySQL
* SQL Server

---

## AI Layer

* Ollama
* Qwen
* Rule-Based SQL Fallback Engine

---

# Database Schema

Major Tables:

```text
auth_users
workspaces
workspace_members
db_connections
db_permissions
table_permissions
access_requests
query_history
query_approvals
audit_logs
```

---

# API Modules

Authentication

```text
/api/auth/register
/api/auth/login
/api/auth/me
```

Workspace

```text
/api/workspaces
```

Databases

```text
/api/workspaces/{id}/databases
/api/workspaces/{id}/databases/{db_id}/schema
/api/workspaces/{id}/databases/{db_id}/refresh-schema
```

AI Query Engine

```text
/api/workspaces/{id}/databases/{db_id}/generate
```

Access Requests

```text
/api/workspaces/{id}/access-requests
```

---

# Project Status

Completed:

* Authentication
* JWT Security
* Workspace Management
* Database Registration
* Schema Discovery
* RBAC
* Access Requests
* Audit Logging
* Ollama Integration
* Query Generation APIs

In Progress:

* SQL Output Validation
* Frontend Integration Testing
* Advanced Visualization

Future Enhancements:

* Dashboard Builder
* Power BI Integration
* Multi-Database Support
* Team Collaboration
* Advanced Analytics
* AI Insights Generation

---

# Author

Group-7



NIT Agartala

Project: QueryBridge – Enterprise AI Data Intelligence Platform
