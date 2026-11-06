'use strict';

const crypto = require('node:crypto');
const express = require('express');
const helmet = require('helmet');
const { Pool } = require('pg');

const app = express();
const port = Number(process.env.PORT || 3002);
const catalogBaseUrl = process.env.CATALOG_SERVICE_URL || 'http://127.0.0.1:3001';
const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'retaildb',
  user: process.env.DB_USER || 'retailapp',
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '32kb' }));

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', service: 'order-service' });
  } catch (_error) {
    res.status(503).json({ status: 'unavailable', service: 'order-service' });
  }
});

app.get('/api/orders', async (req, res) => {
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 20;

  try {
    const result = await pool.query(
      `SELECT o.id, o.order_number AS "orderNumber", o.customer_name AS "customerName",
              o.status, o.total_amount::numeric(12,2)::float8 AS "totalAmount", o.created_at AS "createdAt",
              COALESCE(
                json_agg(json_build_object(
                  'productId', oi.product_id,
                  'productName', oi.product_name,
                  'quantity', oi.quantity,
                  'unitPrice', oi.unit_price::numeric(10,2)::float8,
                  'lineTotal', oi.line_total::numeric(12,2)::float8
                )) FILTER (WHERE oi.id IS NOT NULL), '[]'::json
              ) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ orders: result.rows });
  } catch (error) {
    console.error('Order list query failed:', error.message);
    res.status(500).json({ error: 'Unable to load orders right now.' });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).json({ error: 'Order ID must be numeric.' });
  }

  try {
    const result = await pool.query(
      `SELECT o.id, o.order_number AS "orderNumber", o.customer_name AS "customerName",
              o.status, o.total_amount::numeric(12,2)::float8 AS "totalAmount", o.created_at AS "createdAt",
              COALESCE(
                json_agg(json_build_object(
                  'productId', oi.product_id,
                  'productName', oi.product_name,
                  'quantity', oi.quantity,
                  'unitPrice', oi.unit_price::numeric(10,2)::float8,
                  'lineTotal', oi.line_total::numeric(12,2)::float8
                )) FILTER (WHERE oi.id IS NOT NULL), '[]'::json
              ) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = $1
       GROUP BY o.id`,
      [req.params.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    return res.json({ order: result.rows[0] });
  } catch (error) {
    console.error('Order lookup failed:', error.message);
    return res.status(500).json({ error: 'Unable to load this order right now.' });
  }
});

app.post('/api/orders', async (req, res) => {
  const customerName = typeof req.body.customerName === 'string' ? req.body.customerName.trim() : '';
  const rawItems = req.body.items;

  if (customerName.length < 2 || customerName.length > 100) {
    return res.status(400).json({ error: 'Enter a customer name between 2 and 100 characters.' });
  }
  if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 10) {
    return res.status(400).json({ error: 'An order must contain between 1 and 10 different products.' });
  }

  const items = [];
  const seenProductIds = new Set();
  for (const item of rawItems) {
    const productId = typeof item.productId === 'string' ? item.productId.trim() : '';
    const quantity = Number(item.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return res.status(400).json({ error: 'Each item needs a product ID and a quantity from 1 to 20.' });
    }
    if (seenProductIds.has(productId)) {
      return res.status(400).json({ error: 'A product can appear only once in the order.' });
    }
    seenProductIds.add(productId);
    items.push({ productId, quantity });
  }

  const client = await pool.connect();
  try {
    const pricedItems = [];
    for (const item of items) {
      const response = await fetch(`${catalogBaseUrl}/api/products/${encodeURIComponent(item.productId)}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      if (response.status === 404) {
        return res.status(400).json({ error: `Product ${item.productId} is not available.` });
      }
      if (!response.ok) {
        return res.status(502).json({ error: 'Catalog service could not validate the order.' });
      }
      const payload = await response.json();
      const product = payload.product;
      if (!product || product.stockQuantity < item.quantity) {
        return res.status(409).json({ error: `${product?.name || item.productId} does not have enough listed stock.` });
      }
      pricedItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: Number(product.price),
        lineTotal: Number((Number(product.price) * item.quantity).toFixed(2))
      });
    }

    const totalAmount = Number(pricedItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
    const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    await client.query('BEGIN');
    const orderResult = await client.query(
      `INSERT INTO orders (order_number, customer_name, status, total_amount)
       VALUES ($1, $2, 'PLACED', $3)
       RETURNING id, order_number AS "orderNumber", customer_name AS "customerName", status,
                 total_amount::numeric(12,2)::float8 AS "totalAmount", created_at AS "createdAt"`,
      [orderNumber, customerName, totalAmount]
    );
    const order = orderResult.rows[0];

    for (const item of pricedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, item.productId, item.productName, item.quantity, item.unitPrice, item.lineTotal]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({ order: { ...order, items: pricedItems } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Order creation failed:', error.message);
    return res.status(500).json({ error: 'Unable to place this order right now.' });
  } finally {
    client.release();
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'Request body must contain valid JSON.' });
  }
  console.error('Unhandled order error:', error.message);
  return res.status(500).json({ error: 'Unexpected server error.' });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`order-service listening on port ${port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down order-service`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
