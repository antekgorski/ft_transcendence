# Makefile for ft_transcendence

.PHONY: all build up down restart logs clean re admin

all: build up

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

restart: down up

logs:
	docker compose logs -f

clean:
	docker compose down -v
	docker system prune -f

re: clean build up

admin:
	docker compose exec backend python manage.py createsuperuser