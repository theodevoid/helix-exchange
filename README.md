# Helix Exchange

Production-grade mini exchange monorepo. NestJS API, Go matching engine, NATS JetStream, PostgreSQL, Prisma.

## Prerequisites

- **Node.js** 20+
- **Go** 1.22+
- **pnpm** 8+
- **Docker** (for Postgres + NATS)

## Quick Start

1. Copy environment:

   ```bash
   cp .env.example .env
   cp .env.example apps/api/.env
   ```

2. Start infrastructure (Postgres, NATS):

   ```bash
   make up
   ```

3. Install dependencies and run migrations:

   ```bash
   pnpm install
   make migrate
   ```

4. Run services locally:

   ```bash
   make api      # NestJS API on http://localhost:3000
   make engine   # Go matching engine
   ```

## Structure

```
helix-exchange/
├── apps/
│   ├── api/          # NestJS REST API
│   └── engine/       # Go matching engine
├── packages/
│   └── contracts/    # Shared event types (TypeScript)
└── infra/
    └── docker-compose.yml
```

## Environment

| Variable           | Description              | Default                        |
| ------------------ | ------------------------ | ------------------------------ |
| PORT               | API server port          | 3000                           |
| DATABASE_URL       | PostgreSQL connection    | postgresql://...               |
| NATS_URL           | NATS server URL          | nats://localhost:4222          |
| NATS_MAX_RECONNECT | NATS reconnect attempts  | 10                             |

## Development

- **API**: `make api` or `pnpm --filter api dev`
- **Engine**: `make engine` or `cd apps/engine && go run ./cmd/engine`
- **Database migrations**: `make migrate`
- **Docker logs**: `make logs`

## Docker

| Command   | Description                    |
| --------- | ------------------------------ |
| `make up` | Start Postgres, NATS, API, Engine |
| `make down` | Stop all containers          |
| `make logs` | Tail container logs         |

## Ports

| Service | Port |
| ------- | ---- |
| API     | 3000 |
| Postgres| 5432 |
| NATS    | 4222 |

## Health Check

- API: `GET http://localhost:3000`
- Health: `GET http://localhost:3000/health`
