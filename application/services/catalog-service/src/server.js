'use strict';

const express = require('express');
const helmet = require('helmet');
const { Pool } = require('pg');

const app = express();
const port = Number(process.env.PORT || 3001);
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
    res.status(200).json({ status: 'ok', service: 'catalog-service' });
  } catch (_error) {
    res.status(503).json({ status: 'unavailable', service: 'catalog-service' });
  }
});

app.get('/api/products', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, category, description, price::numeric(10,2)::float8 AS price,
              stock_quantity AS "stockQuantity", image_emoji AS "imageEmoji"
       FROM products WHERE active = TRUE ORDER BY category, name`
    );
    res.json({ products: result.rows });
  } catch (error) {
    console.error('Product list query failed:', error.message);
    res.status(500).json({ error: 'Unable to load products right now.' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, category, description, price::numeric(10,2)::float8 AS price,
              stock_quantity AS "stockQuantity", image_emoji AS "imageEmoji"
       FROM products WHERE id = $1 AND active = TRUE`,
      [req.params.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    return res.json({ product: result.rows[0] });
  } catch (error) {
    console.error('Product lookup failed:', error.message);
    return res.status(500).json({ error: 'Unable to load this product right now.' });
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'Request body must contain valid JSON.' });
  }
  console.error('Unhandled catalog error:', error.message);
  return res.status(500).json({ error: 'Unexpected server error.' });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`catalog-service listening on port ${port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down catalog-service`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
