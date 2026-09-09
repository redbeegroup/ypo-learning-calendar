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
	$(APP) sh -c 'DATABASE_URL=$$DATABASE_URL_TEST npx vitest run'

test-watch:
	$(APP) sh -c 'DATABASE_URL=$$DATABASE_URL_TEST npx vitest'

lint:
	$(APP) npm run lint

typecheck:
	$(APP) npx tsc --noEmit

build-prod:
	docker build --target prod -t ypo-lc:local .

# ---------- production (run on the server) ----------
PROD=$(COMPOSE) -f docker-compose.prod.yml

.PHONY: deploy prod-logs prod-ps prod-seed prod-backup prod-restore prod-down

deploy:
	git pull --ff-only
	$(PROD) build --pull app
	$(PROD) up -d --remove-orphans
	docker image prune -f

prod-logs:
	$(PROD) logs -f --tail 200 app caddy

prod-ps:
	$(PROD) ps

prod-seed:
	$(PROD) exec app node prisma/seed.mjs

prod-backup:
	$(PROD) exec backup sh -c 'pg_dump --no-owner --no-privileges | gzip > /backups/manual-$$(date -u +%Y%m%d-%H%M%S).sql.gz' && ls -la backups | tail -3

# make prod-restore file=backups/ypo-20260909-020000.sql.gz
prod-restore:
	@test -n "$(file)" || (echo "usage: make prod-restore file=backups/<name>.sql.gz" && exit 1)
	gunzip -c $(file) | $(PROD) exec -T db psql -U $${POSTGRES_USER:-ypo} -d $${POSTGRES_DB:-ypo}

prod-down:
	$(PROD) down
