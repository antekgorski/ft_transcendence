# SQL Executor - Quick Start Guide

Simple SQL query interface for managing your Neon PostgreSQL database.

## Setup

1. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your Neon database credentials.

2. **Start the application:**
   ```bash
   docker-compose up -d
   ```
   Use `--build` flag at the first run or after code changes.

3. **Access:**
   - **Application:** http://localhost

## Features

- Clean interface with table browser sidebar
- Execute SQL queries directly
- View table schemas and data
- Example queries for quick testing

## API Endpoints

All proxied through nginx at `/api/`:
- `POST /api/execute/` - Execute SQL query
- `GET /api/tables/` - List all tables
- `GET /api/tables/<table_name>/schema/` - Get table schema

## Usage

1. Click table names in sidebar to generate SELECT queries
2. Write custom SQL in the text area
3. Click "Execute Query"
4. View results below

## Security Warning

⚠️ This tool executes raw SQL directly on your database. Be careful with DELETE, DROP, TRUNCATE, and UPDATE statements. **Development/testing only!**

## Commands

**Stop:**
```bash
docker-compose down
```

**View logs:**
```bash
docker-compose logs -f
```

**Rebuild after changes:**
```bash
docker-compose up -d --build
```

## Troubleshooting

- **Connection errors:** Verify `.env` credentials and that Neon database is active
- **Port conflicts:** Ensure port 80 is available
- **Check logs:** Run `docker-compose logs backend` or `docker-compose logs frontend`
