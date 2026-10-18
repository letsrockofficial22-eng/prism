// Node smoke test for the PrismDB demo backend (browser globals stubbed).
global.window = global;
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; }
};
global.document = { documentElement: { dataset: {} }, addEventListener: () => {}, dispatchEvent: () => {} };
global.CustomEvent = class CustomEvent { constructor(t) { this.type = t; } };

require('./js/db.js');
const DB = global.PrismDB;
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } console.log('ok -', m); };

(async () => {
  assert(DB.mode === 'demo', 'demo mode active without credentials');
  assert(DB.money(1200) === '৳1,200' && DB.money2(25) === '৳25.00', 'prices format as BDT');
  const storeSettings = await DB.getStoreSettings();
  await DB.saveStoreSettings({ ...storeSettings, company_name: 'Test Store' });
  assert((await DB.getStoreSettings()).company_name === 'Test Store', 'store settings persist in demo mode');
  const ps = await DB.listProducts();
  assert(ps.length === 10, 'seeded 10 products');
  const p1 = await DB.getProduct('p1');
  assert(p1 && p1.name === 'iPhone 16 Pro Max', 'get product by id');
  const bySlug = await DB.getProduct('pixel-9-pro');
  assert(bySlug && bySlug.id === 'p3', 'get product by slug');

  let guestOrderRejected = false;
  try { await DB.placeOrder({}, []); } catch (e) { guestOrderRejected = /account|sign in/i.test(e.message); }
  assert(guestOrderRejected, 'guest checkout rejected');

  const customer = await DB.signUp('new-customer@example.com', 'x', 'New Customer');
  assert(customer.user.role === 'customer', 'new accounts receive customer role');
  const customerOrder = await DB.placeOrder({}, []);
  assert((await DB.getOrder(customerOrder.id)).user_id === customer.user.id, 'created customer can place an order');
  let duplicateSignupRejected = false;
  try { await DB.signUp('owner@prism.demo', 'x', ''); } catch (e) { duplicateSignupRejected = /already exists/i.test(e.message); }
  assert(duplicateSignupRejected, 'signup cannot claim an existing admin account');
  await DB.signOut();
  let unknownSignInRejected = false;
  try { await DB.signIn('unknown@example.com', 'x'); } catch (e) { unknownSignInRejected = /create account/i.test(e.message); }
  assert(unknownSignInRejected, 'sign-in does not silently create accounts');

  await DB.signIn('owner@prism.demo', 'x');
  const sess = await DB.session();
  assert(sess && sess.user.role === 'admin', 'demo owner session is admin');

  const before = (await DB.getProduct('p3')).stock;
  const res = await DB.placeOrder(
    { subtotal: 999, discount: 0, shipping: 0, tax: 79.92, total: 1078.92, contact_name: 'Test Buyer', contact_email: 'test@example.com', address: '1 Main St', city: 'Austin', postcode: '78701', country: 'Bangladesh', delivery_method: 'express', payment_method: 'cash_on_delivery' },
    [{ product_id: 'p3', name: 'Pixel 9 Pro', brand: 'Google', image_url: '', options: { storage: '128 GB' }, unit_price: 999, qty: 1, line_total: 999 }]
  );
  assert(/^PR-\d{5}$/.test(res.order_number), 'order number generated: ' + res.order_number);
  const o = await DB.getOrder(res.id);
  assert(o.status === 'pending' && o.items.length === 1 && o.payment_method === 'cash_on_delivery', 'COD order stored with items');
  const after = (await DB.getProduct('p3')).stock;
  assert(after === before - 1, `stock decremented ${before} -> ${after}`);

  await DB.updateOrder(o.id, { status: 'processing', tracking_code: 'TRK-1' });
  const o2 = await DB.getOrder(o.id);
  assert(o2.status === 'processing' && o2.tracking_code === 'TRK-1', 'order status + tracking updated');

  const users = await DB.listUsers();
  assert(users.length >= 5, 'users listed: ' + users.length);
  const owner = users.find((u) => u.email === 'owner@prism.demo');
  assert(owner && owner.orders_count >= 0 && typeof owner.total_spent === 'number', 'user order stats aggregated');
  await DB.setUserRole('u2', 'admin');
  assert((await DB.listUsers()).find((u) => u.id === 'u2').role === 'admin', 'role promoted to admin');
  await DB.setUserRole('u2', 'customer');
  assert((await DB.listUsers()).find((u) => u.id === 'u2').role === 'customer', 'role demoted back');

  const stats = await DB.adminStats();
  assert(stats.ordersCount >= 11 && stats.days.length === 14 && stats.revenue > 0, 'admin stats computed');
  assert(Array.isArray(stats.lowStock), 'low stock list built');

  await DB.sendMessage({ name: 'A', email: 'a@b.c', topic: 't', message: 'm' });
  assert((await DB.listMessages()).length >= 3, 'contact messages stored');
  await DB.subscribe('x@y.z');
  assert((await DB.listSubscribers()).some((s) => s.email === 'x@y.z'), 'newsletter subscriber stored');

  await DB.saveProduct({ id: 'p9', price: 399 });
  assert((await DB.getProduct('p9')).price === 399, 'product price updated (partial patch)');
  await DB.saveProduct({ name: 'Test Phone', brand: 'Test', category: 'budget', price: 100, stock: 5, images: [], is_active: true });
  assert((await DB.listProducts({ all: true })).length === 11, 'new product created');
  const created = (await DB.listProducts({ all: true })).find((p) => p.name === 'Test Phone');
  await DB.deleteProduct(created.id);
  assert((await DB.listProducts({ all: true })).length === 10, 'product deleted');

  DB.cart.add({ product_id: 'p1', name: 'iPhone 16 Pro Max', qty: 2, unit_price: 1199, options: {} });
  assert(DB.cart.count() === 2, 'cart add/count');
  DB.cart.updateQty(0, 3);
  assert(DB.cart.count() === 3, 'cart qty update');
  DB.cart.clear();
  assert(DB.cart.count() === 0, 'cart clear');

  console.log('\nALL DB TESTS PASSED ✔');
})().catch((e) => { console.error('FAIL:', e); process.exit(1); });
