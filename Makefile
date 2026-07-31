.PHONY: up down logs migrate seed test-backend test-bridge setup

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

migrate:
	cd backend && npm run migration:run

seed:
	cd backend && npm run seed

test-backend:
	cd backend && npm test

test-bridge:
	cd bridge && npm test

setup: up
	@echo "Waiting for services to be ready..."
	@sleep 8
	$(MAKE) migrate
	$(MAKE) seed
	@echo ""
	@echo "ClawChat is ready!"
	@echo "  Backend API:  http://localhost:3000/api/v1"
	@echo "  Swagger docs: http://localhost:3000/docs"
	@echo "  Bridge:       http://localhost:3001/health"
	@echo ""
	@echo "Demo credentials:"
	@echo "  Demo accounts are provisioned separately; no password is stored in the repository."
