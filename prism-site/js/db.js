// ============================================================================
// PRISM — data layer.
// One async API, two interchangeable backends:
//   • live : Supabase (when js/config.js has credentials)
//   • demo : seeded localStorage store (works instantly, no credentials)
// ============================================================================
(function () {
  "use strict";

  const cfg = window.PRISM_CONFIG || {};
  const LIVE = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const sb = LIVE ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  // ------------------------------------------------------------------ utils
  const uid = () => "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  const LS = {
    get(k, f) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch (e) { return f; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn("localStorage full", e); } }
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const px = (id) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940`;

  // ------------------------------------------------------------------ demo seed
  function demoSeed() {
    const products = [
      { id: "p1", slug: "iphone-16-pro-max", name: "iPhone 16 Pro Max", brand: "Apple", category: "flagship", price: 1199, compare_at_price: 1299, stock: 24, rating: 4.8, reviews_count: 2431, badge: "New", badge_style: "new",
        tagline: "Titanium. So strong. So light. So Pro.",
        description: "Forged in Grade 5 titanium with the largest display ever on an iPhone — 6.9 inches of Super Retina XDR brilliance with ProMotion up to 120 Hz. Camera Control puts a pro camera in your pocket, and the A18 Pro chip delivers desktop-class performance with all-day battery life.",
        colors: [{ name: "Desert Titanium", hex: "#c9b59a" }, { name: "Natural Titanium", hex: "#b7b4ab" }, { name: "White Titanium", hex: "#e8e6e1" }, { name: "Black Titanium", hex: "#3b3b3f" }, { name: "Blue Titanium", hex: "#2f4a6b" }],
        storage_options: [{ label: "256 GB", delta: 0 }, { label: "512 GB", delta: 200 }, { label: "1 TB", delta: 400 }],
        specs: [{ label: "Display", value: "6.9in Super Retina XDR OLED, 120 Hz" }, { label: "Chipset", value: "A18 Pro" }, { label: "RAM", value: "8 GB" }, { label: "Main camera", value: "48 MP Fusion" }, { label: "Telephoto", value: "12 MP, 5x" }, { label: "Battery", value: "~4,685 mAh, 33 h video" }, { label: "Charging", value: "USB-C, MagSafe 25 W" }, { label: "Weight", value: "227 g" }, { label: "Water resistance", value: "IP68" }, { label: "Updates", value: "5+ years" }, { label: "Stylus", value: "No" }],
        highlights: [{ icon: "cpu", title: "A18 Pro", text: "6-core GPU, 16-core Neural Engine" }, { icon: "camera", title: "48 MP Fusion", text: "+ 48 MP Ultra Wide, 12 MP 5x" }, { icon: "battery", title: "33 h video", text: "Best battery life ever on iPhone" }, { icon: "shield", title: "IP68", text: "Titanium frame, Ceramic Shield" }],
        tags: ["5g", "wireless-charging"], images: [px(10883732), px(30639091), px(15916262), px(13570158)], is_featured: true, is_active: true },
      { id: "p2", slug: "galaxy-s25-ultra", name: "Galaxy S25 Ultra", brand: "Samsung", category: "flagship", price: 1299, compare_at_price: null, stock: 18, rating: 4.9, reviews_count: 1874, badge: "Hot", badge_style: "hot",
        tagline: "The ultimate flagship with S Pen and 200 MP zoom.",
        description: "Galaxy S25 Ultra pairs a 6.9-inch anti-glare AMOLED 2X display with the Snapdragon 8 Elite, a 200 MP main camera and a dual telephoto system. The built-in S Pen and 7 years of updates make it the most flexible Android flagship you can buy.",
        colors: [{ name: "Titanium Silverblue", hex: "#b7c0cd" }, { name: "Titanium Black", hex: "#2e2e30" }, { name: "Titanium Gray", hex: "#54524e" }],
        storage_options: [{ label: "256 GB", delta: 0 }, { label: "512 GB", delta: 100 }, { label: "1 TB", delta: 300 }],
        specs: [{ label: "Display", value: "6.9in AMOLED 2X, 120 Hz, anti-glare" }, { label: "Chipset", value: "Snapdragon 8 Elite" }, { label: "RAM", value: "12 GB" }, { label: "Main camera", value: "200 MP" }, { label: "Telephoto", value: "50 MP 5x + 10 MP 3x" }, { label: "Battery", value: "5,000 mAh" }, { label: "Charging", value: "45 W wired" }, { label: "Weight", value: "218 g" }, { label: "Water resistance", value: "IP68" }, { label: "Updates", value: "7 years" }, { label: "Stylus", value: "S Pen included" }],
        highlights: [{ icon: "camera", title: "200 MP", text: "Quad telephoto zoom system" }, { icon: "cpu", title: "8 Elite", text: "Snapdragon, 12 GB RAM" }, { icon: "battery", title: "5,000 mAh", text: "45 W super-fast charging" }, { icon: "sparkle", title: "S Pen", text: "Built-in stylus + Galaxy AI" }],
        tags: ["5g", "wireless-charging"], images: [px(30466739), px(10885666), px(13570158)], is_featured: true, is_active: true },
      { id: "p3", slug: "pixel-9-pro", name: "Pixel 9 Pro", brand: "Google", category: "flagship", price: 999, compare_at_price: 1099, stock: 31, rating: 4.7, reviews_count: 1120, badge: "-9%", badge_style: "deal",
        tagline: "The brightest screen and the smartest AI in the trio.",
        description: "Pixel 9 Pro brings a 6.3-inch Super Actua display, Tensor G4 with 16 GB of RAM, and seven years of updates. Pro-grade computational photography with a 48 MP 5x telephoto and Gemini AI built into everything.",
        colors: [{ name: "Porcelain", hex: "#e9e5df" }, { name: "Rose Quartz", hex: "#e6c9c4" }, { name: "Hazel", hex: "#5b5a52" }],
        storage_options: [{ label: "128 GB", delta: 0 }, { label: "256 GB", delta: 100 }, { label: "512 GB", delta: 220 }],
        specs: [{ label: "Display", value: "6.3in OLED, 120 Hz, 3,000 nits" }, { label: "Chipset", value: "Tensor G4" }, { label: "RAM", value: "16 GB" }, { label: "Main camera", value: "50 MP" }, { label: "Telephoto", value: "48 MP, 5x" }, { label: "Battery", value: "4,700 mAh" }, { label: "Charging", value: "27 W wired" }, { label: "Weight", value: "199 g" }, { label: "Water resistance", value: "IP68" }, { label: "Updates", value: "7 years" }, { label: "Stylus", value: "No" }],
        highlights: [{ icon: "sparkle", title: "Gemini AI", text: "Built into every app" }, { icon: "camera", title: "50 MP Pro", text: "48 MP 5x telephoto" }, { icon: "cpu", title: "Tensor G4", text: "16 GB RAM" }, { icon: "battery", title: "4,700 mAh", text: "30+ h Adaptive Battery" }],
        tags: ["5g", "wireless-charging"], images: [px(15916262), px(10885666)], is_featured: true, is_active: true },
      { id: "p4", slug: "oneplus-13", name: "OnePlus 13", brand: "OnePlus", category: "flagship", price: 899, compare_at_price: null, stock: 27, rating: 4.6, reviews_count: 864, badge: "", badge_style: "",
        tagline: "A 6,000 mAh battery that refuses to quit.",
        description: "OnePlus 13 packs the Snapdragon 8 Elite, a massive 6,000 mAh silicon-carbon battery and 100 W SUPERVOOC charging into a design that still feels light. Hasselblad-tuned cameras and a 2K 120 Hz display.",
        colors: [{ name: "Midnight Ocean", hex: "#1c2733" }, { name: "Dawn Prism", hex: "#e8e3dd" }],
        storage_options: [{ label: "256 GB", delta: 0 }, { label: "512 GB", delta: 80 }],
        specs: [{ label: "Display", value: "6.8in LTPO OLED, 120 Hz" }, { label: "Chipset", value: "Snapdragon 8 Elite" }, { label: "RAM", value: "12 GB" }, { label: "Main camera", value: "50 MP Hasselblad" }, { label: "Battery", value: "6,000 mAh" }, { label: "Charging", value: "100 W wired, 50 W wireless" }, { label: "Weight", value: "210 g" }, { label: "Water resistance", value: "IP69" }],
        highlights: [], tags: ["5g", "wireless-charging"], images: [px(12166786)], is_featured: false, is_active: true },
      { id: "p5", slug: "xiaomi-15-ultra", name: "Xiaomi 15 Ultra", brand: "Xiaomi", category: "flagship", price: 1099, compare_at_price: null, stock: 14, rating: 4.7, reviews_count: 612, badge: "", badge_style: "",
        tagline: "A 1-inch Leica sensor in your pocket.",
        description: "Co-engineered with Leica, the Xiaomi 15 Ultra features a 1-inch 50 MP main sensor, 200 MP periscope zoom and a 6.7-inch LTPO AMOLED. 90 W wired and 80 W wireless charging on a 6,000 mAh cell.",
        colors: [{ name: "Black", hex: "#26252a" }, { name: "White", hex: "#f2f1ec" }],
        storage_options: [{ label: "512 GB", delta: 0 }, { label: "1 TB", delta: 150 }],
        specs: [{ label: "Display", value: "6.7in LTPO AMOLED, 120 Hz" }, { label: "Chipset", value: "Snapdragon 8 Elite" }, { label: "RAM", value: "16 GB" }, { label: "Main camera", value: "Leica 1in 50 MP" }, { label: "Battery", value: "6,000 mAh" }, { label: "Charging", value: "90 W wired, 80 W wireless" }, { label: "Weight", value: "226 g" }, { label: "Water resistance", value: "IP68" }],
        highlights: [], tags: ["5g", "wireless-charging"], images: [px(10885666)], is_featured: false, is_active: true },
      { id: "p6", slug: "nothing-phone-3", name: "Phone (3)", brand: "Nothing", category: "flagship", price: 799, compare_at_price: null, stock: 22, rating: 4.5, reviews_count: 398, badge: "New", badge_style: "new",
        tagline: "Transparent design with the Glyph Interface.",
        description: "Nothing Phone (3) turns notifications into light with its upgraded Glyph Interface, wrapped in a transparent recycled-aluminium body. Snapdragon 8s Gen 3, 120 Hz AMOLED and a clean Nothing OS.",
        colors: [{ name: "White", hex: "#f2f1ec" }, { name: "Black", hex: "#26252a" }],
        storage_options: [{ label: "256 GB", delta: 0 }, { label: "512 GB", delta: 100 }],
        specs: [{ label: "Display", value: "6.7in AMOLED, 120 Hz" }, { label: "Chipset", value: "Snapdragon 8s Gen 3" }, { label: "RAM", value: "12 GB" }, { label: "Main camera", value: "50 MP" }, { label: "Battery", value: "5,150 mAh" }, { label: "Charging", value: "65 W wired, 15 W wireless" }, { label: "Weight", value: "218 g" }, { label: "Water resistance", value: "IP68" }],
        highlights: [], tags: ["5g", "wireless-charging"], images: [px(14979023)], is_featured: false, is_active: true },
      { id: "p7", slug: "galaxy-z-fold6", name: "Galaxy Z Fold6", brand: "Samsung", category: "foldable", price: 1899, compare_at_price: null, stock: 9, rating: 4.6, reviews_count: 540, badge: "Foldable", badge_style: "",
        tagline: "A 7.6-inch tablet that folds into a phone.",
        description: "The Galaxy Z Fold6 opens into a 7.6-inch canvas for multitasking and folds into a comfortable 6.3-inch phone. Snapdragon 8 Gen 3, 12 GB RAM, IP48 and full S Pen support.",
        colors: [{ name: "Silver Shadow", hex: "#c6c8cc" }, { name: "Pink", hex: "#e6c9c4" }, { name: "Navy", hex: "#2f4a6b" }],
        storage_options: [{ label: "256 GB", delta: 0 }, { label: "512 GB", delta: 120 }, { label: "1 TB", delta: 320 }],
        specs: [{ label: "Display", value: "7.6in fold + 6.3in cover, 120 Hz" }, { label: "Chipset", value: "Snapdragon 8 Gen 3" }, { label: "RAM", value: "12 GB" }, { label: "Main camera", value: "50 MP" }, { label: "Battery", value: "4,400 mAh" }, { label: "Charging", value: "25 W wired" }, { label: "Weight", value: "239 g" }, { label: "Water resistance", value: "IP48" }],
        highlights: [], tags: ["5g", "wireless-charging", "foldable"], images: [px(30466740)], is_featured: false, is_active: true },
      { id: "p8", slug: "iphone-16", name: "iPhone 16", brand: "Apple", category: "flagship", price: 799, compare_at_price: null, stock: 46, rating: 4.7, reviews_count: 3002, badge: "", badge_style: "",
        tagline: "All the essentials, none of the compromise.",
        description: "iPhone 16 brings the A18 chip, Camera Control and the 48 MP Fusion camera to the 6.1-inch lineup, with latest-gen Ceramic Shield and USB-C.",
        colors: [{ name: "Ultramarine", hex: "#2f4a6b" }, { name: "Pink", hex: "#f2c9d3" }, { name: "White", hex: "#f2f1ec" }, { name: "Black", hex: "#26252a" }],
        storage_options: [{ label: "128 GB", delta: 0 }, { label: "256 GB", delta: 100 }, { label: "512 GB", delta: 300 }],
        specs: [{ label: "Display", value: "6.1in OLED, 60 Hz" }, { label: "Chipset", value: "A18" }, { label: "RAM", value: "8 GB" }, { label: "Main camera", value: "48 MP Fusion" }, { label: "Battery", value: "3,561 mAh" }, { label: "Charging", value: "USB-C, MagSafe 25 W" }, { label: "Weight", value: "170 g" }, { label: "Water resistance", value: "IP68" }],
        highlights: [], tags: ["5g", "wireless-charging"], images: [px(12969242)], is_featured: false, is_active: true },
      { id: "p9", slug: "galaxy-a56", name: "Galaxy A56", brand: "Samsung", category: "mid-range", price: 449, compare_at_price: 499, stock: 58, rating: 4.4, reviews_count: 1311, badge: "Deal", badge_style: "deal",
        tagline: "Flagship feel at a mid-range price.",
        description: "The Galaxy A56 brings a 6.7-inch 120 Hz AMOLED, a 50 MP OIS camera and 45 W charging to the mid-range — plus four generations of Android updates.",
        colors: [{ name: "Graphite", hex: "#54524e" }, { name: "Lime", hex: "#c9d6a5" }],
        storage_options: [{ label: "128 GB", delta: 0 }, { label: "256 GB", delta: 50 }],
        specs: [{ label: "Display", value: "6.7in AMOLED, 120 Hz" }, { label: "Chipset", value: "Exynos 1580" }, { label: "RAM", value: "8 GB" }, { label: "Main camera", value: "50 MP OIS" }, { label: "Battery", value: "5,000 mAh" }, { label: "Charging", value: "45 W wired" }, { label: "Weight", value: "198 g" }, { label: "Water resistance", value: "IP67" }],
        highlights: [], tags: ["5g"], images: [px(30466750)], is_featured: false, is_active: true },
      { id: "p10", slug: "pro-max-care-kit", name: "Pro Max care kit", brand: "Prism Essentials", category: "accessory", price: 79, compare_at_price: 119, stock: 120, rating: 4.6, reviews_count: 210, badge: "Bundle", badge_style: "",
        tagline: "Everything to protect your new phone.",
        description: "Clear MagSafe case, tempered screen glass and a 25 W USB-C charger — bundled at a third off.",
        colors: [], storage_options: [],
        specs: [{ label: "Contents", value: "Clear MagSafe case, tempered glass, 25 W charger" }, { label: "Compatibility", value: "iPhone 16 Pro Max" }],
        highlights: [], tags: [], images: [px(8490071)], is_featured: false, is_active: true }
    ];

    const day = 86400000, now = Date.now();
    const iso = (d) => new Date(d).toISOString();
    const users = [
      { id: "u1", email: "owner@prism.demo", full_name: "Store Owner", phone: "", role: "admin", created_at: iso(now - 400 * day) },
      { id: "u2", email: "amara@example.com", full_name: "Amara Mitchell", phone: "+1 555 0101", role: "customer", created_at: iso(now - 120 * day) },
      { id: "u3", email: "jonas@example.com", full_name: "Jonas Keller", phone: "", role: "customer", created_at: iso(now - 90 * day) },
      { id: "u4", email: "priya@example.com", full_name: "Priya Raman", phone: "", role: "customer", created_at: iso(now - 45 * day) },
      { id: "u5", email: "daniel@example.com", full_name: "Daniel Lo", phone: "", role: "customer", created_at: iso(now - 12 * day) }
    ];
    const item = (pid, qty, opts) => {
      const p = products.find((x) => x.id === pid);
      const unit = p.price;
      return { id: uid(), product_id: pid, name: p.name, brand: p.brand, image_url: p.images[0], options: opts || {}, unit_price: unit, qty, line_total: unit * qty };
    };
    let n = 0;
    const order = (daysAgo, userId, status, items, extra) => {
      n += 1;
      const subtotal = items.reduce((s, i) => s + i.line_total, 0);
      const tax = Math.round(subtotal * 0.08 * 100) / 100;
      const u = users.find((x) => x.id === userId) || null;
      return Object.assign({
        id: "o" + n, order_number: "PR-" + String(n).padStart(5, "0"), user_id: userId, status,
        subtotal, discount: 0, shipping: 0, tax, total: Math.round((subtotal + tax) * 100) / 100,
        promo_code: null, delivery_method: "express", payment_method: "card",
        contact_name: u ? u.full_name : "Guest", contact_email: u ? u.email : "guest@example.com", contact_phone: "",
        address: "123 Crystal Avenue", city: "Austin", postcode: "78701", country: "United States",
        tracking_code: status === "shipped" || status === "delivered" ? "1Z-PRISM-" + (1000 + n) : null,
        notes: "", created_at: iso(now - daysAgo * day), updated_at: iso(now - daysAgo * day), items
      }, extra || {});
    };
    const orders = [
      order(0.2, "u5", "pending", [item("p3", 1, { colour: "Porcelain", storage: "256 GB" })]),
      order(0.8, null, "pending", [item("p9", 1, { colour: "Graphite", storage: "128 GB" }), item("p10", 1)], { contact_name: "Marcus King", contact_email: "marcus@example.com", city: "London", country: "United Kingdom" }),
      order(1.5, "u4", "processing", [item("p1", 1, { colour: "Desert Titanium", storage: "256 GB" })]),
      order(2.2, "u2", "shipped", [item("p2", 1, { colour: "Titanium Silverblue", storage: "512 GB" }), item("p10", 1)], { tracking_code: "1Z-PRISM-7741" }),
      order(3.4, "u3", "delivered", [item("p3", 1, { colour: "Hazel", storage: "128 GB" })], { tracking_code: "1Z-PRISM-6620" }),
      order(5.1, null, "delivered", [item("p6", 1)], { contact_name: "Sofia Ortega", contact_email: "sofia@example.com", city: "Madrid", country: "Spain" }),
      order(6.8, "u2", "delivered", [item("p8", 2, { colour: "Pink", storage: "128 GB" })], { tracking_code: "1Z-PRISM-5510" }),
      order(9.2, "u4", "cancelled", [item("p7", 1)], { notes: "Customer changed mind — refunded." }),
      order(12.5, "u3", "delivered", [item("p4", 1, { colour: "Midnight Ocean", storage: "256 GB" })]),
      order(16.1, "u5", "delivered", [item("p5", 1), item("p10", 2)])
    ];
    const messages = [
      { id: uid(), name: "Lena Fischer", email: "lena@example.com", topic: "Help me choose a phone", message: "iPhone 16 Pro or Pixel 9 Pro for photography — which would you pick?", handled: false, created_at: iso(now - 1 * day) },
      { id: uid(), name: "Omar Haddad", email: "omar@example.com", topic: "Order status", message: "My order PR-00004 has been in transit for three days, is that normal?", handled: true, created_at: iso(now - 3 * day) }
    ];
    const subscribers = [{ id: uid(), email: "fan@example.com", created_at: iso(now - 2 * day) }];
    return { products, users, orders, messages, subscribers, seq: orders.length + 1 };
  }

  // ------------------------------------------------------------------ demo backend
  const DEMO_KEY = "prism_demo_db_v1";
  const DEMO_SESSION = "prism_demo_session_v1";
  const DEFAULT_STORE_SETTINGS = {
    company_name: "Prism Mobile Ltd.",
    address: "412 Crystal Avenue",
    city: "Austin",
    region: "TX",
    postal_code: "78701",
    country: "United States",
    phone: "+1 (555) 010-7746",
    email: "hello@prismmobile.com",
    contact_hours: "Mon–Sat 10 am – 8 pm · Sun 12 – 6 pm"
  };

  function demoDB() {
    let db = LS.get(DEMO_KEY, null);
    if (!db || !db.products || db.version !== 3) { db = demoSeed(); db.version = 3; LS.set(DEMO_KEY, db); }
    if (!db.store_settings) { db.store_settings = clone(DEFAULT_STORE_SETTINGS); LS.set(DEMO_KEY, db); }
    const save = () => LS.set(DEMO_KEY, db);
    const sess = () => LS.get(DEMO_SESSION, null);
    const authCbs = [];

    return {
      mode: "demo",
      async init() { return this; },
      async getStoreSettings() { await sleep(80); return clone(db.store_settings); },
      async saveStoreSettings(settings) {
        await sleep(120);
        db.store_settings = Object.assign({}, db.store_settings, settings);
        save();
        return clone(db.store_settings);
      },

      // products
      async listProducts({ all = false } = {}) {
        await sleep(120);
        let rows = clone(db.products);
        if (!all) rows = rows.filter((p) => p.is_active);
        return rows;
      },
      async getProduct(id) { await sleep(60); return clone(db.products.find((p) => p.id === id || p.slug === id) || null); },
      async saveProduct(prod) {
        await sleep(120);
        if (prod.id && db.products.some((p) => p.id === prod.id)) {
          const i = db.products.findIndex((p) => p.id === prod.id);
          db.products[i] = Object.assign({}, db.products[i], prod);
        } else {
          prod.id = uid();
          db.products.unshift(clone(prod));
        }
        save(); return clone(prod);
      },
      async deleteProduct(id) { await sleep(100); db.products = db.products.filter((p) => p.id !== id); save(); },
      async uploadImage(file) {
        return new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
      },

      // orders
      async placeOrder(orderData, items) {
        await sleep(250);
        const s = sess();
        if (!s) throw new Error("Please sign in or create an account before ordering.");
        db.seq += 1;
        const o = Object.assign({ id: uid(), order_number: "PR-" + String(db.seq).padStart(5, "0"), user_id: s ? s.id : null, status: "pending", tracking_code: null, notes: "", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, orderData, { items: clone(items) });
        db.orders.unshift(o);
        items.forEach((i) => { const p = db.products.find((x) => x.id === i.product_id); if (p) p.stock = Math.max(0, (p.stock || 0) - (i.qty || 1)); });
        save();
        return { id: o.id, order_number: o.order_number };
      },
      async listOrders({ userId } = {}) {
        await sleep(120);
        let rows = clone(db.orders);
        if (userId) rows = rows.filter((o) => o.user_id === userId);
        return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
      },
      async getOrder(id) { await sleep(80); return clone(db.orders.find((o) => o.id === id || o.order_number === id) || null); },
      async updateOrder(id, patch) {
        await sleep(120);
        const o = db.orders.find((x) => x.id === id);
        if (o) { Object.assign(o, patch, { updated_at: new Date().toISOString() }); save(); }
        return clone(o);
      },
      async deleteOrder(id) { await sleep(100); db.orders = db.orders.filter((o) => o.id !== id); save(); },

      // users
      async listUsers() {
        await sleep(120);
        return clone(db.users).map((u) => {
          const uo = db.orders.filter((o) => o.user_id === u.id && o.status !== "cancelled");
          return Object.assign({}, u, { orders_count: uo.length, total_spent: uo.reduce((s, o) => s + o.total, 0), last_order: uo.length ? uo.map((o) => o.created_at).sort().pop() : null });
        });
      },
      async setUserRole(id, role) { await sleep(100); const u = db.users.find((x) => x.id === id); if (u) { u.role = role; save(); } return clone(u); },
      async updateProfile(id, patch) { await sleep(100); const u = db.users.find((x) => x.id === id); if (u) { Object.assign(u, patch); save(); } return clone(u); },

      // messages + subscribers
      async sendMessage(m) { await sleep(150); db.messages.unshift(Object.assign({ id: uid(), handled: false, created_at: new Date().toISOString() }, m)); save(); },
      async listMessages() { await sleep(100); return clone(db.messages); },
      async markMessage(id, handled) { const m = db.messages.find((x) => x.id === id); if (m) { m.handled = handled; save(); } },
      async deleteMessage(id) { db.messages = db.messages.filter((m) => m.id !== id); save(); },
      async subscribe(email) {
        await sleep(120);
        if (!db.subscribers.some((s) => s.email === email)) db.subscribers.unshift({ id: uid(), email, created_at: new Date().toISOString() });
        save();
      },
      async listSubscribers() { return clone(db.subscribers); },

      // auth
      async signUp(email, password, fullName) {
        await sleep(250);
        const cleanEmail = String(email || "").trim();
        const existing = db.users.find((x) => x.email.toLowerCase() === cleanEmail.toLowerCase());
        if (existing) throw new Error("An account with this email already exists. Please sign in.");
        const u = { id: uid(), email: cleanEmail, full_name: fullName || "", phone: "", role: "customer", created_at: new Date().toISOString() };
        db.users.push(u);
        save();
        LS.set(DEMO_SESSION, { id: u.id, email: u.email, role: u.role });
        authCbs.forEach((cb) => cb({ user: u }));
        return { user: clone(u) };
      },
      async signIn(email) {
        await sleep(250);
        const u = db.users.find((x) => x.email.toLowerCase() === String(email || "").trim().toLowerCase());
        if (!u) throw new Error("No account found with this email. Choose Create account first.");
        LS.set(DEMO_SESSION, { id: u.id, email: u.email, role: u.role });
        authCbs.forEach((cb) => cb({ user: u }));
        return { user: clone(u) };
      },
      async signOut() { localStorage.removeItem(DEMO_SESSION); authCbs.forEach((cb) => cb(null)); },
      async session() {
        const s = sess();
        if (!s) return null;
        const u = db.users.find((x) => x.id === s.id);
        return u ? { user: clone(u) } : null;
      },
      onAuth(cb) { authCbs.push(cb); }
    };
  }

  // ------------------------------------------------------------------ live backend
  function liveDB() {
    const authCbs = [];
    let profileCache = {};

    const profileOf = async (userId) => {
      if (!userId) return null;
      if (profileCache[userId]) return profileCache[userId];
      const { data } = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (data) profileCache[userId] = data;
      return data;
    };
    const myProfile = async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return null;
      return profileOf(session.user.id);
    };
    const requireAdmin = async () => {
      const p = await myProfile();
      if (!p || p.role !== "admin") throw new Error("Admin access required");
      return p;
    };

    sb.auth.onAuthStateChange((_e, session) => {
      authCbs.forEach((cb) => cb(session ? { user: Object.assign({}, session.user, { full_name: session.user.user_metadata?.full_name || "", role: profileCache[session.user.id]?.role }) } : null));
    });

    return {
      mode: "live",
      sb,
      async init() { return this; },
      async getStoreSettings() {
        const { data, error } = await sb.from("store_settings").select("*").eq("id", 1).maybeSingle();
        if (error) throw error;
        return Object.assign({}, DEFAULT_STORE_SETTINGS, data || {});
      },
      async saveStoreSettings(settings) {
        await requireAdmin();
        const { data, error } = await sb.from("store_settings").upsert(Object.assign({ id: 1 }, settings)).select().single();
        if (error) throw error;
        return Object.assign({}, DEFAULT_STORE_SETTINGS, data);
      },

      // products
      async listProducts({ all = false } = {}) {
        let q = sb.from("products").select("*").order("created_at", { ascending: false });
        if (!all) q = q.eq("is_active", true);
        const { data, error } = await q;
        if (error) throw error;
        return data;
      },
      async getProduct(id) {
        const col = id.startsWith("00000000-") || /^[0-9a-f-]{36}$/i.test(id) ? "id" : "slug";
        const { data, error } = await sb.from("products").select("*").eq(col, id).maybeSingle();
        if (error) throw error;
        return data;
      },
      async saveProduct(prod) {
        await requireAdmin();
        const row = Object.assign({}, prod);
        delete row.id; delete row.created_at; delete row.updated_at;
        if (prod.id) {
          const { data, error } = await sb.from("products").update(row).eq("id", prod.id).select().single();
          if (error) throw error; return data;
        }
        row.slug = row.slug || (row.name || "product").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).slice(2, 6);
        const { data, error } = await sb.from("products").insert(row).select().single();
        if (error) throw error; return data;
      },
      async deleteProduct(id) {
        await requireAdmin();
        const { error } = await sb.from("products").delete().eq("id", id);
        if (error) throw error;
      },
      async uploadImage(file) {
        await requireAdmin();
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await sb.storage.from("product-images").upload(path, file, { upsert: false });
        if (error) throw error;
        return sb.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      },

      // orders
      async placeOrder(orderData, items) {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) throw new Error("Please sign in or create an account before ordering.");
        const { data: id, error } = await sb.rpc("place_order", {
          p_order: orderData,
          p_items: items.map((i) => ({ product_id: i.product_id || "", name: i.name, brand: i.brand || "", image_url: i.image_url || "", options: i.options || {}, unit_price: i.unit_price, qty: i.qty, line_total: i.line_total }))
        });
        if (error) throw error;
        const { data: o } = await sb.from("orders").select("id, order_number").eq("id", id).maybeSingle();
        return { id, order_number: o ? o.order_number : "" };
      },
      async listOrders({ userId } = {}) {
        let q = sb.from("orders").select("*").order("created_at", { ascending: false });
        if (userId) q = q.eq("user_id", userId);
        const { data, error } = await q;
        if (error) throw error;
        return data;
      },
      async getOrder(id) {
        const col = /^[0-9a-f-]{36}$/i.test(id) ? "id" : "order_number";
        const { data, error } = await sb.from("orders").select("*, items:order_items(*)").eq(col, id).maybeSingle();
        if (error) throw error;
        return data;
      },
      async updateOrder(id, patch) {
        await requireAdmin();
        const { data, error } = await sb.from("orders").update(patch).eq("id", id).select().single();
        if (error) throw error;
        return data;
      },
      async deleteOrder(id) {
        await requireAdmin();
        const { error } = await sb.from("orders").delete().eq("id", id);
        if (error) throw error;
      },

      // users
      async listUsers() {
        await requireAdmin();
        const [{ data: users, error: e1 }, { data: orders, error: e2 }] = await Promise.all([
          sb.from("profiles").select("*").order("created_at", { ascending: false }),
          sb.from("orders").select("id,user_id,total,status,created_at")
        ]);
        if (e1) throw e1; if (e2) throw e2;
        return (users || []).map((u) => {
          const uo = (orders || []).filter((o) => o.user_id === u.id && o.status !== "cancelled");
          return Object.assign({}, u, {
            orders_count: uo.length,
            total_spent: uo.reduce((s, o) => s + Number(o.total || 0), 0),
            last_order: uo.length ? uo.map((o) => o.created_at).sort().pop() : null
          });
        });
      },
      async setUserRole(id, role) {
        await requireAdmin();
        const { error } = await sb.from("profiles").update({ role }).eq("id", id);
        if (error) throw error;
        delete profileCache[id];
      },
      async updateProfile(id, patch) {
        const { error } = await sb.from("profiles").update(patch).eq("id", id);
        if (error) throw error;
        delete profileCache[id];
      },

      // messages + subscribers
      async sendMessage(m) { const { error } = await sb.from("messages").insert(m); if (error) throw error; },
      async listMessages() { await requireAdmin(); const { data, error } = await sb.from("messages").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; },
      async markMessage(id, handled) { await requireAdmin(); await sb.from("messages").update({ handled }).eq("id", id); },
      async deleteMessage(id) { await requireAdmin(); await sb.from("messages").delete().eq("id", id); },
      async subscribe(email) { await sb.from("subscribers").upsert({ email }, { onConflict: "email" }); },
      async listSubscribers() { await requireAdmin(); const { data, error } = await sb.from("subscribers").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; },

      // auth
      async signUp(email, password, fullName) {
        const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: fullName || "" } } });
        if (error) throw error;
        return data;
      },
      async signIn(email, password) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        profileCache = {};
        return data;
      },
      async signOut() { await sb.auth.signOut(); profileCache = {}; },
      async session() {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return null;
        const p = await profileOf(session.user.id);
        return { user: Object.assign({}, session.user, { full_name: session.user.user_metadata?.full_name || p?.full_name || "", role: p?.role || "customer", profile: p }) };
      },
      async refreshRole() {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) return null;
        delete profileCache[session.user.id];
        return profileOf(session.user.id);
      },
      onAuth(cb) { authCbs.push(cb); }
    };
  }

  // ------------------------------------------------------------------ shared helpers
  const DB = LIVE ? liveDB() : demoDB();

  DB.money = (n) => "৳" + Number(n || 0).toLocaleString("en-BD", { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 });
  DB.money2 = (n) => "৳" + Number(n || 0).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  DB.fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
  DB.fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  DB.adminStats = async function () {
    const [orders, users, products] = await Promise.all([
      DB.listOrders().catch(() => []),
      DB.listUsers().catch(() => []),
      DB.listProducts({ all: true }).catch(() => [])
    ]);
    const live = orders.filter((o) => o.status !== "cancelled");
    const revenue = live.reduce((s, o) => s + Number(o.total || 0), 0);
    const byStatus = { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
    orders.forEach((o) => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const dayOrders = live.filter((o) => { const t = new Date(o.created_at); return t >= d && t < next; });
      days.push({ label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), revenue: dayOrders.reduce((s, o) => s + Number(o.total || 0), 0), count: dayOrders.length });
    }
    const lowStock = products.filter((p) => p.is_active && (p.stock || 0) <= 10).sort((a, b) => a.stock - b.stock).slice(0, 5);
    return { orders, users, products, revenue, byStatus, days, lowStock,
      ordersCount: orders.length, usersCount: users.length, productsCount: products.length,
      pendingCount: byStatus.pending + byStatus.processing };
  };

  // cart (localStorage, shared by both modes)
  const CART_KEY = "prism_cart_v1";
  DB.cart = {
    get() { return LS.get(CART_KEY, []); },
    set(items) { LS.set(CART_KEY, items); document.dispatchEvent(new CustomEvent("cart:changed")); },
    count() { return this.get().reduce((s, i) => s + (i.qty || 1), 0); },
    add(item) {
      const items = this.get();
      const key = (i) => [i.product_id, i.options?.colour, i.options?.storage, i.options?.protection].join("|");
      const found = items.find((i) => key(i) === key(item));
      if (found) found.qty += item.qty || 1;
      else items.push(Object.assign({ qty: 1 }, item));
      this.set(items);
    },
    updateQty(idx, qty) { const items = this.get(); if (items[idx]) { items[idx].qty = Math.max(1, qty); this.set(items); } },
    remove(idx) { const items = this.get(); items.splice(idx, 1); this.set(items); },
    clear() { this.set([]); }
  };

  window.PrismDB = DB;
  document.documentElement.dataset.mode = DB.mode;
})();
