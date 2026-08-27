# TaskForge ⚡

TaskForge is a high-performance, real-time Agile Project Management & Jira Clone built with **FastAPI**, **React + Vite**, **PostgreSQL (Supabase)**, **Redis**, and **Apache Kafka**.

---

## 🌟 Key Features

- 🏢 **Organization & Workspace Hub**: Multi-tenant organizations with 8-character unique invite codes (`POST /join`), role-based access (Admin, Project Manager, Developer, Viewer), and project grouping.
- 📋 **Interactive Kanban Board**: Drag-and-drop issue movement, optimistic concurrency versioning, and status column filtering.
- 🏃 **Agile Sprints Management**: Plan sprints, attach backlog issues, track real-time completion percentages, and execute spring starts/completions.
- 📦 **Backlog & "Assigned to Me" View**: Filter issues by priority (Urgent, High, Medium, Low), status, type, and keyword search with 1-click sprint assignment.
- 🔔 **Real-Time Notification Popups**: Glassmorphic toast popups that slide in automatically for work assignment, comments, sprint starts, and status updates.
- 📜 **Tiered Project Audit Trail Explorer**: Immutable event log with compact summary view for all team members and deep JSON payload diff expansion for Admins.
- 💬 **Issue Detail & Comments Drawer**: Real-time comments, label tagging, priority updating, and assignee management.
- 🗑️ **Role-Protected Deletion**: Admin-only workspace and project deletion safeguards.

---

## 🛠️ Tech Stack

### Backend
- **FastAPI** (Python 3.12 / 3.9) — Asynchronous REST API framework
- **SQLAlchemy 2.0 (Async)** + **asyncpg** — Object Relational Mapper
- **PostgreSQL 16** / **Supabase** — Persistent disk database
- **Redis 7** — Caching, token blacklisting, and rate limiting
- **Apache Kafka** + **ZooKeeper** (`aiokafka`) — Domain event streaming
- **Alembic** — Schema migrations & database versioning
- **Pytest + pytest-asyncio** — Comprehensive test suite (61+ passing tests)

### Frontend
- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** + Custom Design System
- **@tanstack/react-query** — State management and query caching
- **Zustand** — Client-side authentication store

---

## 🚀 Quick Start (Docker)

To run the entire platform with all services pre-configured:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Access the services:
- **Web App**: [http://localhost:3000](http://localhost:3000)
- **API Docs (Swagger)**: [http://localhost:3000/docs](http://localhost:3000/docs)
- **Health Check**: [http://localhost:3000/health](http://localhost:3000/health)

---

## 💻 Local Development

### 1. Backend Setup
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 Testing

Run the automated backend test suite:
```bash
cd backend
.venv/bin/pytest app/tests/ -v
```

---

## 📄 License
MIT License.
