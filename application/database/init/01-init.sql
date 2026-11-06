CREATE TABLE IF NOT EXISTS products (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    category        TEXT NOT NULL,
    description     TEXT NOT NULL,
    price           NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    stock_quantity  INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    image_emoji     TEXT NOT NULL DEFAULT '📦',
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id              BIGSERIAL PRIMARY KEY,
    order_number    TEXT NOT NULL UNIQUE,
    customer_name   TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'PLACED',
    total_amount    NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id              BIGSERIAL PRIMARY KEY,
    order_id        BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      TEXT NOT NULL,
    product_name    TEXT NOT NULL,
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    unit_price      NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    line_total      NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

INSERT INTO products (id, name, category, description, price, stock_quantity, image_emoji)
VALUES
    ('audio-001', 'Studio Wireless Headphones', 'Electronics', 'Comfortable over-ear headphones with clear sound for work and travel.', 3499.00, 24, '🎧'),
    ('desk-002', 'Ergonomic Desk Lamp', 'Workspace', 'Adjustable LED desk lamp with warm and cool light modes.', 1299.00, 40, '💡'),
    ('bottle-003', 'Insulated Steel Bottle', 'Lifestyle', 'Double-wall insulated bottle designed to keep drinks at temperature.', 799.00, 55, '🥤'),
    ('keyboard-004', 'Mechanical Keyboard', 'Electronics', 'Compact mechanical keyboard for productive everyday typing.', 2899.00, 18, '⌨️'),
    ('bag-005', 'Everyday Laptop Backpack', 'Lifestyle', 'Water-resistant backpack with a padded laptop compartment.', 1899.00, 31, '🎒'),
    ('mug-006', 'Ceramic Coffee Mug Set', 'Home', 'Set of two minimal ceramic mugs for your home or office.', 599.00, 60, '☕')
ON CONFLICT (id) DO NOTHING;
