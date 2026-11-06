'use strict';

const state = {
  products: [],
  cart: new Map(),
  submitting: false
};

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

const elements = {
  productGrid: document.querySelector('#product-grid'),
  catalogMessage: document.querySelector('#catalog-message'),
  cartCount: document.querySelector('#cart-count'),
  cartSummaryCount: document.querySelector('#cart-summary-count'),
  cartItems: document.querySelector('#cart-items'),
  cartTotal: document.querySelector('#cart-total'),
  checkoutForm: document.querySelector('#checkout-form'),
  customerName: document.querySelector('#customer-name'),
  placeOrder: document.querySelector('#place-order'),
  checkoutMessage: document.querySelector('#checkout-message'),
  ordersList: document.querySelector('#orders-list'),
  refreshOrders: document.querySelector('#refresh-orders')
};

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }
  return payload;
}

function renderProducts() {
  elements.productGrid.replaceChildren();
  if (state.products.length === 0) return;

  for (const product of state.products) {
    const card = document.createElement('article');
    card.className = 'product-card';

    const art = document.createElement('div');
    art.className = 'product-art';
    const category = document.createElement('span');
    category.className = 'product-category';
    category.textContent = product.category;
    const emoji = document.createElement('span');
    emoji.className = 'product-emoji';
    emoji.setAttribute('aria-hidden', 'true');
    emoji.textContent = product.imageEmoji || '📦';
    art.append(category, emoji);

    const info = document.createElement('div');
    info.className = 'product-info';
    const name = document.createElement('h3');
    name.textContent = product.name;
    const description = document.createElement('p');
    description.className = 'product-description';
    description.textContent = product.description;
    const bottom = document.createElement('div');
    bottom.className = 'product-bottom';
    const price = document.createElement('strong');
    price.className = 'product-price';
    price.textContent = currency.format(product.price);
    const add = document.createElement('button');
    add.className = 'add-button';
    add.type = 'button';
    add.textContent = product.stockQuantity > 0 ? 'Add to bag +' : 'Out of stock';
    add.disabled = product.stockQuantity < 1;
    add.addEventListener('click', () => addToCart(product.id));
    bottom.append(price, add);
    info.append(name, description, bottom);
    card.append(art, info);
    elements.productGrid.append(card);
  }
}

function addToCart(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;
  const current = state.cart.get(productId) || 0;
  if (current >= Math.min(product.stockQuantity, 20)) {
    setMessage(elements.checkoutMessage, 'The selected quantity is at the available demo limit.', true);
    return;
  }
  state.cart.set(productId, current + 1);
  setMessage(elements.checkoutMessage, 'Added to your bag.');
  renderCart();
}

function changeQuantity(productId, delta) {
  const product = state.products.find((item) => item.id === productId);
  const current = state.cart.get(productId) || 0;
  const next = current + delta;
  if (next <= 0) state.cart.delete(productId);
  else if (product && next <= Math.min(product.stockQuantity, 20)) state.cart.set(productId, next);
  renderCart();
}

function cartItems() {
  return [...state.cart.entries()].map(([productId, quantity]) => {
    const product = state.products.find((item) => item.id === productId);
    return product ? { ...product, quantity, lineTotal: product.price * quantity } : null;
  }).filter(Boolean);
}

function renderCart() {
  const items = cartItems();
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
  elements.cartCount.textContent = String(count);
  elements.cartSummaryCount.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
  elements.cartTotal.textContent = currency.format(total);
  elements.placeOrder.disabled = count === 0 || state.submitting;
  elements.cartItems.replaceChildren();

  if (items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Your bag is waiting for something good.';
    elements.cartItems.append(empty);
    return;
  }

  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'cart-row';
    const thumb = document.createElement('span');
    thumb.className = 'cart-thumb';
    thumb.textContent = item.imageEmoji || '📦';
    const details = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'cart-product-name';
    name.textContent = item.name;
    const price = document.createElement('div');
    price.className = 'cart-product-price';
    price.textContent = currency.format(item.price);
    details.append(name, price);

    const quantity = document.createElement('div');
    quantity.className = 'quantity-control';
    const minus = document.createElement('button');
    minus.type = 'button';
    minus.setAttribute('aria-label', `Remove one ${item.name}`);
    minus.textContent = '−';
    minus.addEventListener('click', () => changeQuantity(item.id, -1));
    const value = document.createElement('span');
    value.textContent = String(item.quantity);
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.setAttribute('aria-label', `Add one ${item.name}`);
    plus.textContent = '+';
    plus.disabled = item.quantity >= Math.min(item.stockQuantity, 20);
    plus.addEventListener('click', () => changeQuantity(item.id, 1));
    quantity.append(minus, value, plus);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      state.cart.delete(item.id);
      renderCart();
    });
    row.append(thumb, details, quantity, remove);
    elements.cartItems.append(row);
  }
}

function renderOrders(orders) {
  elements.ordersList.replaceChildren();
  if (!orders.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No orders yet. Place your first demo order above.';
    elements.ordersList.append(empty);
    return;
  }

  for (const order of orders) {
    const card = document.createElement('article');
    card.className = 'order-card';
    const details = document.createElement('div');
    const number = document.createElement('div');
    number.className = 'order-number';
    number.textContent = order.orderNumber;
    const meta = document.createElement('div');
    meta.className = 'order-meta';
    const when = new Date(order.createdAt);
    const itemCount = (order.items || []).reduce((sum, item) => sum + item.quantity, 0);
    meta.textContent = `${order.customerName} · ${itemCount} ${itemCount === 1 ? 'item' : 'items'} · ${when.toLocaleString('en-IN')}`;
    details.append(number, meta);
    const status = document.createElement('span');
    status.className = 'order-status';
    status.textContent = order.status;
    const amount = document.createElement('strong');
    amount.className = 'order-amount';
    amount.textContent = currency.format(order.totalAmount);
    card.append(details, status, amount);
    elements.ordersList.append(card);
  }
}

async function loadProducts() {
  setMessage(elements.catalogMessage, 'Loading the collection…');
  try {
    const payload = await apiRequest('/api/catalog/products');
    state.products = payload.products || [];
    renderProducts();
    setMessage(elements.catalogMessage, `${state.products.length} products available in the catalog.`);
  } catch (error) {
    setMessage(elements.catalogMessage, `Catalog unavailable: ${error.message}`, true);
  }
}

async function loadOrders() {
  try {
    const payload = await apiRequest('/api/orders?limit=10');
    renderOrders(payload.orders || []);
  } catch (error) {
    elements.ordersList.textContent = `Unable to load recent orders: ${error.message}`;
  }
}

async function placeOrder(event) {
  event.preventDefault();
  const name = elements.customerName.value.trim();
  const items = cartItems().map((item) => ({ productId: item.id, quantity: item.quantity }));
  if (items.length === 0) {
    setMessage(elements.checkoutMessage, 'Add at least one product before checkout.', true);
    return;
  }

  state.submitting = true;
  elements.placeOrder.disabled = true;
  elements.placeOrder.textContent = 'Placing order…';
  setMessage(elements.checkoutMessage, 'Creating your order…');

  try {
    const payload = await apiRequest('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ customerName: name, items })
    });
    state.cart.clear();
    renderCart();
    elements.checkoutForm.reset();
    setMessage(elements.checkoutMessage, `Order ${payload.order.orderNumber} placed successfully.`);
    await loadOrders();
    document.querySelector('#orders').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    setMessage(elements.checkoutMessage, error.message, true);
  } finally {
    state.submitting = false;
    elements.placeOrder.innerHTML = 'Place demo order <span>→</span>';
    renderCart();
  }
}

elements.checkoutForm.addEventListener('submit', placeOrder);
elements.refreshOrders.addEventListener('click', loadOrders);
renderCart();
loadProducts();
loadOrders();
