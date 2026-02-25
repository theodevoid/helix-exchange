.PHONY: up down infra api engine migrate logs

up:
	docker compose -f infra/docker-compose.yml up -d

down:
	docker compose -f infra/docker-compose.yml down

infra:
	docker compose -f infra/docker-compose.yml up -d postgres nats

api:
	pnpm --filter api dev

engine:
	cd apps/engine && go run ./cmd/engine

migrate:
	pnpm --filter api exec prisma migrate dev

logs:
	docker compose -f infra/docker-compose.yml logs -f
