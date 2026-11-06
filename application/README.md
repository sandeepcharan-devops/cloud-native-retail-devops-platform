# Retail Order Management Platform — Application MVP

This directory contains the first working application slice for the Cloud-Native Retail DevOps Platform.

## What is included

- **Frontend:** responsive retail storefront served by NGINX.
- **Catalog service:** Node.js/Express API that reads products from PostgreSQL.
- **Order service:** Node.js/Express API that validates catalog products and persists orders.
- **Database:** PostgreSQL schema and sample catalog data.
- **Local runtime:** Docker Compose with separate containers and an internal application network.

The checkout is a demo flow. It does not collect payments, send notifications, or decrement stock. Those capabilities are planned for later service increments (inventory, payment simulation, and notifications).

## Run locally with Docker Compose

1. Install Docker Engine and the Docker Compose plugin.
2. Change to this directory:

   ```bash
   cd application
   ```

3. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and replace `POSTGRES_PASSWORD` with a unique development password. Do not commit `.env`.
5. Build and start the stack:

   ```bash
   docker compose up -d --build
   ```

6. Check service status:

   ```bash
   docker compose ps
   docker compose logs --tail=100
   ```

7. Open the storefront at `http://localhost:8088`.

## API endpoints

| Service | Method | Endpoint | Purpose |
|---|---|---|---|
| Catalog | GET | `/api/catalog/products` | List active products |
| Catalog | GET | `/api/catalog/products/:id` | Get one product |
| Orders | GET | `/api/orders` | List recent orders |
| Orders | GET | `/api/orders/:id` | Get an order |
| Orders | POST | `/api/orders` | Place a demo order |
| Catalog | GET | `/health` (internal) | Catalog health check |
| Orders | GET | `/health` (internal) | Order service health check |

The NGINX frontend container proxies browser requests to the internal service containers. The database is not published to the host.

## Smoke tests

```bash
curl -fsS http://localhost:8088/api/catalog/products
curl -fsS http://localhost:8088/api/orders
```

Place a demo order:

```bash
curl -fsS -X POST http://localhost:8088/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"customerName":"Demo Customer","items":[{"productId":"audio-001","quantity":1}]}'
```

Then list orders again:

```bash
curl -fsS http://localhost:8088/api/orders
```

## Useful operations

```bash
# View logs
docker compose logs -f

# Stop containers but keep PostgreSQL data
docker compose down

# Stop containers and DELETE local PostgreSQL data (destructive)
docker compose down -v
```

## Architecture notes

- The catalog and order APIs are separate services and containers.
- The order service gets product names and prices from the catalog service; the browser does not supply trusted prices.
- PostgreSQL data persists in a named Docker volume.
- Compose health checks gate service startup.
- The Compose network is internal to this application stack. Only the frontend port is published.
- This is a learning/development MVP, not a production-ready commerce system. Before production, add authentication/authorization, rate limits, robust inventory reservation, payment provider integration, event-driven notifications, migrations, secrets management, backups, observability, and resilience testing.
