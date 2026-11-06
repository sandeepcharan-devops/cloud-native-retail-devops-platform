#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8088}"

printf '\n== Catalog API ==\n'
curl --fail --silent --show-error "$BASE_URL/api/catalog/products"

printf '\n\n== Existing orders ==\n'
curl --fail --silent --show-error "$BASE_URL/api/orders"

printf '\n\n== Create demo order ==\n'
curl --fail --silent --show-error \
  -X POST "$BASE_URL/api/orders" \
  -H 'Content-Type: application/json' \
  -d '{"customerName":"DevOps Demo","items":[{"productId":"audio-001","quantity":1}]}'

printf '\n\n== Updated orders ==\n'
curl --fail --silent --show-error "$BASE_URL/api/orders"
printf '\n\nSmoke tests completed.\n'
