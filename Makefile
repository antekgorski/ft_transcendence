# Makefile for ft_transcendence

# Detect docker compose command (docker-compose or docker compose)
DOCKER_COMPOSE := $(shell command -v docker-compose 2> /dev/null)
ifndef DOCKER_COMPOSE
	DOCKER_COMPOSE := docker compose
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

logs:
	$(DOCKER_COMPOSE) logs -f

clean:
	$(DOCKER_COMPOSE) down -v
	docker system prune -f

re: clean build up

admin:
	$(DOCKER_COMPOSE) exec backend python manage.py createsuperuser

.PHONY: all build up down restart restart_frontend restart_backend restart_redis logs clean re admin