COMPOSE=docker compose
APP=$(COMPOSE) exec app

.PHONY: dev up down logs shell install migrate migrate-dev seed studio test test-watch lint typecheck build-prod

.env:
	cp .env.example .env

dev: .env
	$(COMPOSE) up --build

up: .env
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f app

shell:
	$(APP) sh

install:
	$(APP) npm install

migrate:
	$(APP) npx prisma migrate deploy

migrate-dev:
	$(APP) npx prisma migrate dev --name $(name)

seed:
	$(APP) npx prisma db seed

studio:
	$(COMPOSE) exec -p 5555:5555 app npx prisma studio --port 5555 --hostname 0.0.0.0

test:
	$(APP) npx vitest run

test-watch:
	$(APP) npx vitest

lint:
	$(APP) npm run lint

typecheck:
	$(APP) npx tsc --noEmit

build-prod:
	docker build --target prod -t ypo-lc:local .
