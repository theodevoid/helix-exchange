.PHONY: up down infra api migrate logs nats-setup

up:
	docker compose -f infra/docker-compose.yml up -d

down:
	docker compose -f infra/docker-compose.yml down

infra:
	docker compose -f infra/docker-compose.yml up -d postgres nats

api:
	pnpm --filter api dev

migrate:
	pnpm --filter api exec prisma migrate dev

logs:
	docker compose -f infra/docker-compose.yml logs -f

nats-setup:
	pnpm --filter api exec tsx scripts/setup-nats-streams.ts
