# TrackRock

Geospatial intelligence platform tracking institutional home acquisitions and their impact on neighborhoods.

## Prerequisites

- Node.js 20+
- Docker Desktop
- npm 10+

## Setup

```bash
# 1. Install dependencies
cd trackrock
npm install

# 2. Copy and fill in environment variables
cp .env.example .env
# Fill in API keys in .env

# 3. Start PostgreSQL + Redis
docker-compose -f docker/docker-compose.yml up -d

# 4. Run migrations (Prisma + PostGIS geometry column)
npm run migrate -w backend

# 5. Seed with Austin demo data
npm run seed:austin

# 6. Start dev servers (frontend + backend concurrently)
npm run dev
```

Frontend: http://localhost:5173  
Backend:  http://localhost:3001  
API docs: http://localhost:3001/api/health

## Database commands

```bash
# Open Prisma Studio (DB browser)
npm run studio -w backend

# Create a new migration after schema changes
npm run migrate:dev -w backend

# Reset database (drops all data)
npx prisma migrate reset --schema=backend/prisma/schema.prisma
```

## Docker

```bash
# Start services
docker-compose -f docker/docker-compose.yml up -d

# Stop services
docker-compose -f docker/docker-compose.yml down

# Wipe data volumes
docker-compose -f docker/docker-compose.yml down -v
```
