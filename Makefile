# Makefile for ft_transcendence

# Check for Docker Compose v2 or docker-compose
DOCKER_COMPOSE := $(shell if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then echo "docker compose"; elif command -v docker-compose >/dev/null 2>&1; then echo "docker-compose"; fi)
ifndef DOCKER_COMPOSE
	$(error Docker Compose is not available. Install Docker Compose v2 or docker-compose)
endif

all: build up

build:
	$(DOCKER_COMPOSE) build

up:
	$(DOCKER_COMPOSE) up -d

down:
	$(DOCKER_COMPOSE) down

restart: down up

restart_frontend:
	$(DOCKER_COMPOSE) restart frontend

restart_backend:
	$(DOCKER_COMPOSE) restart backend

restart_redis:
	$(DOCKER_COMPOSE) restart redis

restart_nginx:
	$(DOCKER_COMPOSE) restart nginx

rebuild_frontend:
	$(DOCKER_COMPOSE) rm -fs frontend && $(DOCKER_COMPOSE) up -d --build --no-deps --force-recreate frontend

rebuild_backend:
	$(DOCKER_COMPOSE) rm -fs backend && $(DOCKER_COMPOSE) up -d --build --no-deps --force-recreate backend

rebuild_redis:
	$(DOCKER_COMPOSE) rm -fs redis && $(DOCKER_COMPOSE) up -d --build --no-deps --force-recreate redis

rebuild_nginx:
	$(DOCKER_COMPOSE) rm -fs nginx && $(DOCKER_COMPOSE) up -d --build --no-deps --force-recreate nginx

logs:
	$(DOCKER_COMPOSE) logs -f

clean:
	$(DOCKER_COMPOSE) down -v
	docker run --rm -v "$(CURDIR)/backend:/workspace" alpine sh -c "rm -rf /workspace/staticfiles"
	docker system prune -f

re: clean build up

admin:
	$(DOCKER_COMPOSE) exec backend python manage.py createsuperuser

.PHONY: all build up down restart restart_frontend restart_backend restart_redis logs clean re admin