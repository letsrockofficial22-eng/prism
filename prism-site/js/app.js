// ============================================================================
// PRISM — storefront logic. Renders products/orders/auth from PrismDB
// (live Supabase or browser demo). Page is chosen by <section id="...">.
// ============================================================================
(function () {
  "use strict";
  const DB = window.PrismDB;
  const { esc, toast } = window.UI;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const params = new URLSearchParams(location.search);
  const money = (n) => DB.money(n);

  // ---------------------------------------------------------------- helpers
  function specChips(p) {
    const specs = p.specs || [];
    const disp = specs.find((s) => /display/i.test(s.label));
    const chip = specs.find((s) => /chipset/i.test(s.label));
    const sto = (p.storage_options || [])[0];
    const out = [];
    if (disp) { const m = String(disp.value).match(/([\d.]+)\s*in/i); if (m) out.push(m[1] + "″"); }
    if (sto) out.push(sto.label);
    if (chip) out.push(chip.value);
    if (!out.length) specs.slice(0, 2).forEach((s) => out.push(String(s.value).split(",")[0]));
    return out.slice(0, 3);
  }

  function cardHTML(p) {
    const img = (p.images && p.images[0]) || "";
    const badge = p.badge ? `<span class="badge ${p.badge_style || ""}">${esc(p.badge)}</span>` : "";
    const cmp = p.compare_at_price && Number(p.compare_at_price) > Number(p.price) ? `<s>${money(p.compare_at_price)}</s>` : "";
    const oos = (p.stock || 0) <= 0;
    return `
    <article class="card glass" data-id="${esc(p.id)}">
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="card-media"><img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy">${badge}</a>
      <button class="icon-btn wish" type="button" data-wish="${esc(p.id)}" aria-label="Save to wishlist"><svg class="ic sm"><use href="#i-heart"/></svg></button>
      <div class="card-body">
        <span class="brand">${esc(p.brand)}</span>
        <h3><a href="product.html?id=${encodeURIComponent(p.id)}">${esc(p.name)}</a></h3>
        <div class="specs">${specChips(p).map((c) => `<span>${esc(c)}</span>`).join("")}</div>
        <div class="rating">${UI.stars(p.rating)}<small>${Number(p.rating || 0).toFixed(1)} · ${Number(p.reviews_count || 0).toLocaleString()}</small></div>
        <div class="card-foot">
          <div class="price">${oos ? '<span class="muted">Sold out</span>' : money(p.price) + cmp}</div>
          ${oos ? "" : `<button class="add" type="button" data-add="${esc(p.id)}" aria-label="Add to cart"><svg class="ic"><use href="#i-plus"/></svg></button>`}
        </div>
      </div>
    </article>`;
  }

  function skeletons(n, html) {
    let s = "";
    for (let i = 0; i < n; i++) s += html || '<div class="card glass sk-card"><div class="sk" style="aspect-ratio:1;border-radius:18px"></div><div class="sk" style="height:14px;margin:14px 6px 0"></div><div class="sk" style="height:18px;width:60%;margin:10px 6px"></div><div class="sk" style="height:14px;width:40%;margin:0 6px 18px"></div></div>';
    return s;
  }

  const WISH_KEY = "prism_wishlist_v1";
  const wish = {
    get() { try { return JSON.parse(localStorage.getItem(WISH_KEY)) || []; } catch (e) { return []; } },
    toggle(id) { const w = this.get(); const i = w.indexOf(id); if (i >= 0) w.splice(i, 1); else w.push(id); localStorage.setItem(WISH_KEY, JSON.stringify(w)); return i < 0; }
  };

  function addDefaultToCart(id, qty) {
    return DB.getProduct(id).then((p) => {
      if (!p) return toast("Product not found", "error");
      DB.cart.add({
        product_id: p.id, name: p.name, brand: p.brand, image_url: (p.images && p.images[0]) || "",
        unit_price: Number(p.price), qty: qty || 1,
        options: { colour: (p.colors && p.colors[0] && p.colors[0].name) || "", storage: (p.storage_options && p.storage_options[0] && p.storage_options[0].label) || "", protection: "Prism Care" }
      });
      toast(p.name + " added to cart", "ok");
    });
  }

  // delegated events (dynamic content)
  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) { e.preventDefault(); addDefaultToCart(add.dataset.add); return; }
    const w = e.target.closest("[data-wish]");
    if (w) {
      e.preventDefault();
      const on = wish.toggle(w.dataset.wish);
      w.classList.toggle("active", on);
      toast(on ? "Saved to wishlist" : "Removed from wishlist");
      return;
    }
  });

  document.addEventListener("click", async (e) => {
    const link = e.target.closest('a[href="#product"]');
    if (!link) return;
    const card = link.closest(".card, .cmp-prod");
    const name = card && card.querySelector("h3, b")?.textContent.trim();
    if (!name) return;
    e.preventDefault();
    const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const key = normalize(name);
    try {
      const products = await DB.listProducts({ all: true });
      const product = products.find((p) => normalize(p.name) === key)
        || products.find((p) => { const slug = normalize(p.slug); return slug && key.includes(slug); });
      if (!product) { toast("Product not found", "error"); return; }
      location.assign("product.html?id=" + encodeURIComponent(product.id));
    } catch (err) {
      toast(err.message || "Could not open product", "error");
    }
  });

  function paintWishes() {
    const w = wish.get();
    $$("[data-wish]").forEach((b) => b.classList.toggle("active", w.includes(b.dataset.wish)));
  }

  // ---------------------------------------------------------------- header
  function updateCartBadge() {
    const dot = $("#cart-count");
    if (!dot) return;
    const n = DB.cart.count();
    dot.textContent = n;
    dot.hidden = n === 0;
    const link = dot.closest("a");
    if (link) link.setAttribute("aria-label", `Cart, ${n} items`);
  }
  document.addEventListener("cart:changed", updateCartBadge);

  async function updateAccountBtn() {
    const btn = $("#account-btn");
    if (!btn) return;
    const s = await DB.session().catch(() => null);
    if (s && s.user) {
      btn.href = "account.html";
      btn.title = s.user.full_name || s.user.email || "Account";
    } else {
      btn.href = "login.html";
      btn.title = "Sign in";
    }
  }

  // ---------------------------------------------------------------- home
  async function initHome() {
    const grid = $("#featured-grid");
    if (!grid) return;
    grid.innerHTML = skeletons(4);
    let ps = await DB.listProducts();
    let featured = ps.filter((p) => p.is_featured);
    if (featured.length < 4) featured = featured.concat(ps.filter((p) => !p.is_featured).sort((a, b) => b.rating - a.rating)).slice(0, 4);
    grid.innerHTML = featured.slice(0, 4).map(cardHTML).join("") || '<p class="muted">No products yet — add some in the admin panel.</p>';
    paintWishes();
    const newsForm = $("#newsletter-form");
    if (newsForm) newsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("#newsletter-email").value.trim();
      if (!email || !email.includes("@")) return toast("Please enter a valid email", "error");
      try { await DB.subscribe(email); newsForm.reset(); toast("You're on the list — welcome!", "ok"); }
      catch (err) { toast(err.message || "Could not subscribe", "error"); }
    });
  }

  // ---------------------------------------------------------------- shop
  async function initShop() {
    const grid = $("#shop-grid");
    if (!grid) return;
    grid.innerHTML = skeletons(6);
    const all = await DB.listProducts();
    const PER_PAGE = 9;
    const state = {
      q: (params.get("q") || "").toLowerCase(),
      cat: params.get("cat") || "",
      brands: params.get("brand") ? [params.get("brand")] : [],
      storages: [], tags: [], stockOnly: false,
      maxPrice: Math.max(1000, Math.ceil(Math.max(...all.map((p) => Number(p.price)), 500) / 100) * 100),
      sort: "recommended", page: 1
    };
    const priceInput = $("#filter-price");
    priceInput.max = state.maxPrice; priceInput.value = state.maxPrice;
    $("#filter-price-max").textContent = money(state.maxPrice);

    // build brand / category / storage filters from real data
    const brands = [...new Set(all.map((p) => p.brand))].sort();
    $("#filter-brands").innerHTML = brands.map((b) =>
      `<label class="check"><input type="checkbox" data-brand="${esc(b)}" ${state.brands.includes(b) ? "checked" : ""}><span>${esc(b)}</span><em class="fcount">${all.filter((p) => p.brand === b).length}</em></label>`).join("");
    const cats = [...new Set(all.map((p) => p.category))];
    $("#filter-cats").innerHTML = cats.map((c) =>
      `<label class="check"><input type="checkbox" data-cat="${esc(c)}" ${state.cat === c ? "checked" : ""}><span>${esc(c[0].toUpperCase() + c.slice(1))}</span><em class="fcount">${all.filter((p) => p.category === c).length}</em></label>`).join("");
    const storages = [...new Set(all.flatMap((p) => (p.storage_options || []).map((o) => o.label)))].sort();
    $("#filter-storage").innerHTML = storages.map((s) =>
      `<label class="check"><input type="checkbox" data-storage="${esc(s)}"><span>${esc(s)}</span><em class="fcount">${all.filter((p) => (p.storage_options || []).some((o) => o.label === s)).length}</em></label>`).join("");

    if (state.q) { const si = $(".search-pill input"); if (si) si.value = state.q; }

    function filtered() {
      let rows = all.filter((p) => {
        if (state.brands.length && !state.brands.includes(p.brand)) return false;
        const selCats = $$("[data-cat]").filter((c) => c.checked).map((c) => c.dataset.cat);
        if (selCats.length && !selCats.includes(p.category)) return false;
        if (Number(p.price) > Number(priceInput.value)) return false;
        if (state.storages.length && !(p.storage_options || []).some((o) => state.storages.includes(o.label))) return false;
        if (state.tags.length && !state.tags.every((t) => (p.tags || []).includes(t))) return false;
        if (state.stockOnly && (p.stock || 0) <= 0) return false;
        if (state.q) {
          const hay = (p.name + " " + p.brand + " " + (p.tagline || "")).toLowerCase();
          if (!hay.includes(state.q)) return false;
        }
        return true;
      });
      const s = state.sort;
      if (s === "price-asc") rows.sort((a, b) => a.price - b.price);
      else if (s === "price-desc") rows.sort((a, b) => b.price - a.price);
      else if (s === "rating") rows.sort((a, b) => b.rating - a.rating);
      else if (s === "newest") rows.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
      else rows.sort((a, b) => (b.is_featured - a.is_featured) || (b.rating - a.rating));
      return rows;
    }

    function renderChips() {
      const chips = [];
      const selCats = $$("[data-cat]").filter((c) => c.checked).map((c) => c.dataset.cat);
      state.brands.forEach((b) => chips.push({ t: b, k: "brand", v: b }));
      selCats.forEach((c) => chips.push({ t: c[0].toUpperCase() + c.slice(1), k: "cat", v: c }));
      state.storages.forEach((s2) => chips.push({ t: s2, k: "storage", v: s2 }));
      state.tags.forEach((t) => chips.push({ t: t.replace(/-/g, " "), k: "tag", v: t }));
      if (state.stockOnly) chips.push({ t: "In stock", k: "stock", v: "1" });
      if (Number(priceInput.value) < state.maxPrice) chips.push({ t: "Under " + money(priceInput.value), k: "price", v: priceInput.value });
      if (state.q) chips.push({ t: "“" + state.q + "”", k: "q", v: state.q });
      $("#filter-chips").innerHTML = chips.map((c) =>
        `<span>${esc(c.t)} <button type="button" data-rm="${c.k}:${esc(c.v)}" aria-label="Remove filter"><svg class="ic"><use href="#i-x"/></svg></button></span>`).join("");
      const count = $("#filter-active-count");
      if (count) { count.textContent = chips.length; count.hidden = chips.length === 0; }
    }

    function render() {
      const rows = filtered();
      const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
      state.page = Math.min(state.page, pages);
      const slice = rows.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE);
      $("#results-count").innerHTML = rows.length
        ? `Showing <b>${(state.page - 1) * PER_PAGE + 1}–${Math.min(state.page * PER_PAGE, rows.length)}</b> of <b>${rows.length}</b> phones`
        : `No phones match your filters`;
      grid.innerHTML = slice.map(cardHTML).join("") || '<div class="empty glass" style="grid-column:1/-1"><h3>Nothing here yet</h3><p class="muted mt-1">Try removing a filter or two.</p></div>';
      paintWishes();
      renderChips();
      // pager
      let pg = "";
      const arrow = (dir, dis) => `<a href="#" data-page="${state.page + dir}" class="${dis ? "dis" : ""}" aria-label="${dir < 0 ? "Previous" : "Next"} page"><svg class="ic sm" ${dir < 0 ? 'style="transform:rotate(180deg)"' : ""}><use href="#i-chev"/></svg></a>`;
      if (pages > 1) {
        pg += arrow(-1, state.page === 1);
        const nums = [];
        for (let i = 1; i <= pages; i++) { if (i === 1 || i === pages || Math.abs(i - state.page) <= 1) nums.push(i); else if (nums[nums.length - 1] !== "…") nums.push("…"); }
        nums.forEach((n2) => { pg += n2 === "…" ? "<span>…</span>" : `<a href="#" data-page="${n2}" class="${n2 === state.page ? "on" : ""}">${n2}</a>`; });
        pg += arrow(1, state.page === pages);
      }
      $("#shop-pager").innerHTML = pg;
    }

    // events
    $("#filter-brands").addEventListener("change", (e) => {
      const b = e.target.dataset.brand; if (!b) return;
      if (e.target.checked) state.brands.push(b); else state.brands = state.brands.filter((x) => x !== b);
      state.page = 1; render();
    });
    $("#filter-cats").addEventListener("change", () => { state.page = 1; render(); });
    $("#filter-storage").addEventListener("change", (e) => {
      const s2 = e.target.dataset.storage; if (!s2) return;
      if (e.target.checked) state.storages.push(s2); else state.storages = state.storages.filter((x) => x !== s2);
      state.page = 1; render();
    });
    priceInput.addEventListener("input", () => { $("#filter-price-out").textContent = Number(priceInput.value) >= state.maxPrice ? "any price" : "up to " + money(priceInput.value); state.page = 1; render(); });
    $$("[data-tag]").forEach((sw) => sw.addEventListener("change", () => {
      const t = sw.dataset.tag;
      if (sw.checked) state.tags.push(t); else state.tags = state.tags.filter((x) => x !== t);
      state.page = 1; render();
    }));
    $("#filter-stock").addEventListener("change", (e) => { state.stockOnly = e.target.checked; state.page = 1; render(); });
    $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
    $("#filters-reset").addEventListener("click", () => {
      state.q = ""; state.cat = ""; state.brands = []; state.storages = []; state.tags = []; state.stockOnly = false;
      $("[data-brand]") && $$('[data-brand], [data-cat], [data-storage], [data-tag]').forEach((input) => { input.checked = false; });
      $("#filter-stock").checked = false;
      priceInput.value = state.maxPrice;
      $("#filter-price-out").textContent = "any price";
      $("#sort").value = "recommended"; state.sort = "recommended"; state.page = 1;
      const search = $(".search-pill input"); if (search) search.value = "";
      render();
    });
    const dropdown = $(".filter-dropdown");
    const toggle = $("#filters-toggle");
    const panel = $("#shop-filter-panel");
    function setFiltersOpen(open) {
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      if (open) {
        const availableHeight = window.innerHeight - dropdown.getBoundingClientRect().bottom - 16;
        panel.style.setProperty("--filters-max-height", Math.max(120, availableHeight) + "px");
      }
    }
    toggle.addEventListener("click", () => setFiltersOpen(panel.hidden));
    document.addEventListener("click", (e) => { if (!dropdown.contains(e.target)) setFiltersOpen(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setFiltersOpen(false); });
    window.addEventListener("resize", () => { if (!panel.hidden) setFiltersOpen(true); });
    $("#filters-apply")?.addEventListener("click", () => { state.page = 1; render(); setFiltersOpen(false); });
    $("#filter-chips").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-rm]"); if (!btn) return;
      const [k, v] = btn.dataset.rm.split(":");
      if (k === "brand") { state.brands = state.brands.filter((x) => x !== v); const cb = $(`[data-brand="${CSS.escape(v)}"]`); if (cb) cb.checked = false; }
      if (k === "cat") { const cb = $(`[data-cat="${CSS.escape(v)}"]`); if (cb) cb.checked = false; }
      if (k === "storage") { state.storages = state.storages.filter((x) => x !== v); const cb = $(`[data-storage="${CSS.escape(v)}"]`); if (cb) cb.checked = false; }
      if (k === "tag") { state.tags = state.tags.filter((x) => x !== v); const cb = $(`[data-tag="${CSS.escape(v)}"]`); if (cb) cb.checked = false; }
      if (k === "stock") { state.stockOnly = false; $("#filter-stock").checked = false; }
      if (k === "price") { priceInput.value = state.maxPrice; $("#filter-price-out").textContent = "any price"; }
      if (k === "q") { state.q = ""; }
      state.page = 1; render();
    });
    $("#shop-pager").addEventListener("click", (e) => {
      const a = e.target.closest("[data-page]"); if (!a || a.classList.contains("dis")) return;
      e.preventDefault(); state.page = Number(a.dataset.page); render(); window.scrollTo({ top: 0, behavior: "smooth" });
    });
    const searchInput = $(".search-pill input");
    if (searchInput) searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); state.q = searchInput.value.toLowerCase().trim(); state.page = 1; render(); } });

    render();
  }

  // ---------------------------------------------------------------- product
  async function initProduct() {
    const root = $("#pd-info");
    if (!root) return;
    const id = params.get("id") || params.get("slug");
    $("#pd-gallery").innerHTML = '<div class="sk" style="aspect-ratio:1;border-radius:22px"></div>';
    root.innerHTML = '<div class="sk" style="height:26px;width:40%;margin:8px 0 16px"></div><div class="sk" style="height:42px;width:80%;margin-bottom:16px"></div><div class="sk" style="height:20px;width:60%"></div>';
    let p = id ? await DB.getProduct(id) : null;
    if (!p) { const ps = await DB.listProducts(); p = ps.find((x) => x.is_featured) || ps[0]; }
    if (!p) { root.innerHTML = '<div class="empty"><h3>Product not found</h3><a href="shop.html" class="btn btn-primary mt-2">Back to shop</a></div>'; return; }

    document.title = p.name + " — Prism";
    $("#pd-crumbs").innerHTML = `<a href="index.html">Home</a><svg class="ic"><use href="#i-chev"/></svg><a href="shop.html">Shop</a><svg class="ic"><use href="#i-chev"/></svg><a href="shop.html?brand=${encodeURIComponent(p.brand)}">${esc(p.brand)}</a><svg class="ic"><use href="#i-chev"/></svg><span>${esc(p.name)}</span>`;

    // gallery
    const imgs = (p.images && p.images.length ? p.images : [""]);
    $("#pd-gallery").innerHTML = `
      ${imgs.map((_, i) => `<input type="radio" name="gal" id="g${i + 1}" ${i === 0 ? "checked" : ""}>`).join("")}
      <div class="g-main">
        ${imgs.map((src, i) => `<img class="gi-${i + 1}" src="${esc(src)}" alt="${esc(p.name)} view ${i + 1}">`).join("")}
        ${p.badge ? `<span class="badge ${p.badge_style || ""}">${esc(p.badge)}</span>` : ""}
      </div>
      <div class="thumbs" style="grid-template-columns:repeat(${imgs.length},1fr)">
        ${imgs.map((src, i) => `<label for="g${i + 1}"><img src="${esc(src)}" alt=""></label>`).join("")}
      </div>`;
    // dynamic gallery needs CSS beyond #g1..#g4 — use a tiny inline style for n images
    const galCss = imgs.map((_, i) => `#g${i + 1}:checked ~ .g-main .gi-${i + 1}{opacity:1;transform:none}#g${i + 1}:checked ~ .thumbs label[for=g${i + 1}]{border-color:var(--cyan);opacity:1}`).join("");
    let st = $("#pd-gal-css");
    if (!st) { st = document.createElement("style"); st.id = "pd-gal-css"; document.head.appendChild(st); }
    st.textContent = galCss;

    const base = Number(p.price);
    const cmp = p.compare_at_price && Number(p.compare_at_price) > base ? Number(p.compare_at_price) : null;
    const colors = p.colors || [];
    const storages = p.storage_options || [];
    const stockTxt = (p.stock || 0) > 0 ? `<span style="color:var(--green)">In stock · ${p.stock} left</span>` : `<span style="color:var(--red)">Sold out</span>`;

    root.innerHTML = `
      <span class="brand">${esc(p.brand)} · Unlocked</span>
      <h1>${esc(p.name)}</h1>
      <div class="rating">${UI.stars(p.rating)}<small>${Number(p.rating || 0).toFixed(1)} · ${Number(p.reviews_count || 0).toLocaleString()} reviews · ${stockTxt}</small></div>
      <div class="pprice"><b id="pd-price">${money(base)}</b>${cmp ? `<s id="pd-cmp">${money(cmp)}</s><span class="save" id="pd-save">Save ${money(cmp - base)}</span>` : ""}</div>
      <p class="fin">or <b id="pd-fin">${money(Math.round((base / 24) * 100) / 100)}/mo</b> for 24 months at 0% APR · trade-in credit applied at checkout</p>
      <p class="muted mt-2">${esc(p.tagline || "")}</p>
      ${colors.length ? `<div class="opt"><h4>Colour <span id="pd-colour-name">${esc(colors[0].name)}</span></h4><div class="swatches">
        ${colors.map((c, i) => `<input type="radio" name="col" id="c${i + 1}" ${i === 0 ? "checked" : ""} data-name="${esc(c.name)}"><label for="c${i + 1}" style="--c:${esc(c.hex)}" title="${esc(c.name)}"></label>`).join("")}
      </div></div>` : ""}
      ${storages.length ? `<div class="opt"><h4>Storage</h4><div class="pills" id="pd-storage">
        ${storages.map((o, i) => `<input type="radio" name="sto" id="s${i + 1}" ${i === 0 ? "checked" : ""} data-delta="${o.delta || 0}" data-label="${esc(o.label)}"><label for="s${i + 1}">${esc(o.label)}<small>${money(base + (o.delta || 0))}</small></label>`).join("")}
      </div></div>` : ""}
      <div class="opt"><h4>Protection</h4><div class="pills" id="pd-care">
        <input type="radio" name="care" id="pc1" data-delta="0" data-label="None"><label for="pc1">None<small>Standard warranty</small></label>
        <input type="radio" name="care" id="pc2" checked data-delta="0" data-label="Prism Care"><label for="pc2">Prism Care<small>Included · 2 yrs</small></label>
        <input type="radio" name="care" id="pc3" data-delta="149" data-label="Care+ Theft"><label for="pc3">Care+ Theft<small>+৳149</small></label>
      </div></div>
      <div class="buy-row">
        <div class="qty"><button type="button" id="pd-minus" aria-label="Decrease"><svg class="ic sm"><use href="#i-minus"/></svg></button><span id="pd-qty">1</span><button type="button" id="pd-plus" aria-label="Increase"><svg class="ic sm"><use href="#i-plus"/></svg></button></div>
        <button class="btn btn-primary" id="pd-add" ${(p.stock || 0) <= 0 ? "disabled" : ""}><svg class="ic"><use href="#i-cart"/></svg> Add to cart</button>
        <button class="btn btn-glass" id="pd-buy" ${(p.stock || 0) <= 0 ? "disabled" : ""}>Buy now</button>
      </div>
      <ul class="perks">
        <li><svg class="ic"><use href="#i-check"/></svg> Free 48h express delivery — order in the next 3h 12m for Thursday</li>
        <li><svg class="ic"><use href="#i-check"/></svg> 30-day no-questions returns</li>
        <li><svg class="ic"><use href="#i-check"/></svg> 2-year Prism Care accidental damage cover included</li>
        <li><svg class="ic"><use href="#i-check"/></svg> Up to ৳500 trade-in credit for your current phone</li>
      </ul>`;

    // tabs
    const hl = p.highlights || [];
    const specs = p.specs || [];
    $("#pd-tabs").innerHTML = `
      <input type="radio" name="tab" id="t1" checked><input type="radio" name="tab" id="t2"><input type="radio" name="tab" id="t3">
      <div class="tab-nav"><label for="t1">Overview</label><label for="t2">Tech specs</label><label for="t3">Reviews (${Number(p.reviews_count || 0).toLocaleString()})</label></div>
      <div class="tab-panel tp-1">
        <h3>${esc(p.tagline || p.name)}</h3>
        <p>${esc(p.description || "")}</p>
        ${hl.length ? `<div class="hl">${hl.map((h) => `<div><svg class="ic"><use href="#i-${esc(h.icon)}"/></svg><b>${esc(h.title)}</b><small>${esc(h.text)}</small></div>`).join("")}</div>` : ""}
      </div>
      <div class="tab-panel tp-2">
        <h3>Technical specifications</h3>
        <div class="spec-table">${specs.map((s2) => `<div><span>${esc(s2.label)}</span><span>${esc(s2.value)}</span></div>`).join("") || "<p class='muted'>No specs listed.</p>"}</div>
      </div>
      <div class="tab-panel tp-3">
        <div class="rev-sum">
          <div><div class="big">${Number(p.rating || 0).toFixed(1)}</div>${UI.stars(p.rating)}<p class="muted" style="font-size:.85rem">${Number(p.reviews_count || 0).toLocaleString()} verified reviews</p></div>
          <div class="rbars">
            ${[84, 11, 3, 1, 1].map((w, i) => `<div><span>${5 - i} ★</span><div class="bar"><i style="width:${w}%"></i></div><span>${w}%</span></div>`).join("")}
          </div>
        </div>
        <p class="muted mt-2">Written reviews for this product will appear here.</p>
      </div>`;

    // interactions
    let qty = 1;
    const unitPrice = () => {
      const sd = Number(($("#pd-storage input:checked") || {}).dataset?.delta || 0);
      const cd = Number(($("#pd-care input:checked") || {}).dataset?.delta || 0);
      return base + sd + cd;
    };
    function refreshPrice() {
      const u = unitPrice();
      $("#pd-price").textContent = money(u);
      $("#pd-fin").textContent = money(Math.round((u / 24) * 100) / 100) + "/mo";
      const save = $("#pd-save"), cmpEl = $("#pd-cmp");
      if (save && cmp) { save.textContent = "Save " + money(cmp - u); save.hidden = cmp - u <= 0; cmpEl.hidden = cmp - u <= 0; }
    }
    $$("#pd-storage input").forEach((r) => r.addEventListener("change", refreshPrice));
    $$("#pd-care input").forEach((r) => r.addEventListener("change", refreshPrice));
    $$("input[name=col]").forEach((r) => r.addEventListener("change", () => { const n = $("#pd-colour-name"); if (n) n.textContent = r.dataset.name; }));
    $("#pd-minus")?.addEventListener("click", () => { qty = Math.max(1, qty - 1); $("#pd-qty").textContent = qty; });
    $("#pd-plus")?.addEventListener("click", () => { qty = Math.min(Math.max(1, p.stock || 9), qty + 1); $("#pd-qty").textContent = qty; });

    function cartItem() {
      return {
        product_id: p.id, name: p.name, brand: p.brand, image_url: (p.images && p.images[0]) || "",
        unit_price: unitPrice(), qty,
        options: {
          colour: ($("input[name=col]:checked") || {}).dataset?.name || "",
          storage: ($("#pd-storage input:checked") || {}).dataset?.label || "",
          protection: ($("#pd-care input:checked") || {}).dataset?.label || "Prism Care"
        }
      };
    }
    $("#pd-add")?.addEventListener("click", () => { DB.cart.add(cartItem()); toast(p.name + " added to cart", "ok"); });
    $("#pd-buy")?.addEventListener("click", () => { DB.cart.add(cartItem()); location.assign("checkout.html"); });

    // related
    const ps = await DB.listProducts();
    const rel = ps.filter((x) => x.id !== p.id && (x.is_featured || x.brand === p.brand)).slice(0, 4);
    $("#pd-related").innerHTML = (rel.length ? rel : ps.filter((x) => x.id !== p.id).slice(0, 4)).map(cardHTML).join("");
    paintWishes();
  }

  // ---------------------------------------------------------------- compare
  async function initCompare() {
    const root = $("#cmp-table");
    if (!root) return;
    root.innerHTML = '<div class="sk" style="height:420px;border-radius:22px"></div>';
    const ps = await DB.listProducts();
    let ids = (params.get("ids") || "").split(",").filter(Boolean);
    let chosen = ids.map((i) => ps.find((p) => p.id === i || p.slug === i)).filter(Boolean);
    if (chosen.length < 2) chosen = ps.filter((p) => p.is_featured && p.category === "flagship").slice(0, 3);
    if (chosen.length < 2) chosen = ps.slice(0, 3);
    chosen = chosen.slice(0, 4);
    const dots = ["#a78bfa", "#22d3ee", "#f472b6", "#fbbf24"];

    $("#cmp-pick").innerHTML = chosen.map((p, i) =>
      `<span><i style="--c:${dots[i % 4]}"></i>${esc(p.name)}</span>`).join("") +
      '<a class="dashed" href="shop.html" style="display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border-radius:999px;border:1px dashed var(--stroke);color:var(--muted);font-size:.9rem"><svg class="ic sm"><use href="#i-plus"/></svg> Add a phone</a>';

    const ROWS = ["Display", "Chipset", "RAM", "Main camera", "Telephoto", "Battery", "Charging", "Weight", "Water resistance", "Updates", "Stylus"];
    const specOf = (p, label) => { const s = (p.specs || []).find((x) => x.label.toLowerCase() === label.toLowerCase()); return s ? s.value : "—"; };
    root.innerHTML = `<table>
      <thead><tr><th>Specification</th>${chosen.map((p) => `<th><div class="cmp-prod"><img src="${esc((p.images || [""])[0])}" alt="${esc(p.name)}"><b>${esc(p.name)}</b><small>${esc(p.brand)}</small><a href="product.html?id=${encodeURIComponent(p.id)}" class="btn btn-glass btn-sm">View</a></div></th>`).join("")}</tr></thead>
      <tbody>
        ${ROWS.map((r) => `<tr><td>${r}</td>${chosen.map((p) => { const v = specOf(p, r); return `<td class="${v === "—" ? "muted" : ""}">${esc(v)}</td>`; }).join("")}</tr>`).join("")}
        <tr><td>Price</td>${chosen.map((p) => `<td><div class="price">${money(p.price)}</div><button class="btn btn-primary btn-sm mt-1" data-add="${esc(p.id)}">Add to cart</button></td>`).join("")}</tr>
      </tbody></table>`;

    const cheapest = chosen.reduce((a, b) => (a.price <= b.price ? a : b));
    const priciest = chosen.reduce((a, b) => (a.price >= b.price ? a : b));
    const loved = chosen.reduce((a, b) => (a.rating >= b.rating ? a : b));
    $("#cmp-verdicts").innerHTML = `
      <div class="feat glass"><span class="ic-wrap"><svg class="ic lg"><use href="#i-tag"/></svg></span><h3>Best value — ${esc(cheapest.name)}</h3><p>The lowest price of the group at ${money(cheapest.price)}, without giving up flagship basics.</p></div>
      <div class="feat glass"><span class="ic-wrap"><svg class="ic lg"><use href="#i-zap"/></svg></span><h3>Premium pick — ${esc(priciest.name)}</h3><p>At ${money(priciest.price)} this is the no-compromise option of the three.</p></div>
      <div class="feat glass"><span class="ic-wrap"><svg class="ic lg"><use href="#i-sparkle"/></svg></span><h3>Most loved — ${esc(loved.name)}</h3><p>Highest customer rating in the group: ${Number(loved.rating).toFixed(1)} ★ from ${Number(loved.reviews_count || 0).toLocaleString()} reviews.</p></div>`;
  }

  // ---------------------------------------------------------------- cart math
  const PROMO = { PRISM10: 0.1 };
  const getPromo = () => localStorage.getItem("prism_promo") || "";
  function totals(items, deliveryShip) {
    const subtotal = items.reduce((s, i) => s + Number(i.unit_price) * (i.qty || 1), 0);
    const code = getPromo();
    const discount = PROMO[code] ? Math.round(subtotal * PROMO[code] * 100) / 100 : 0;
    const shipping = deliveryShip || 0;
    const tax = Math.round((subtotal - discount) * 0.08 * 100) / 100;
    const total = Math.round((subtotal - discount + shipping + tax) * 100) / 100;
    return { subtotal, discount, shipping, tax, total, code: discount ? code : "" };
  }

  // ---------------------------------------------------------------- cart page
  function initCart() {
    const root = $("#cart-root");
    if (!root) return;
    function render() {
      const items = DB.cart.get();
      $("#cart-count-label").textContent = items.length ? `(${items.reduce((s, i) => s + i.qty, 0)} items)` : "";
      if (!items.length) {
        root.innerHTML = `<div class="empty glass"><span class="eyebrow">Nothing here yet</span><h2 class="mt-1">Your cart is empty</h2><p class="muted mt-1">Browse the range and add something brilliant.</p><a href="shop.html" class="btn btn-primary btn-lg mt-2">Shop phones <svg class="ic"><use href="#i-arrow"/></svg></a></div>`;
        return;
      }
      const t = totals(items);
      root.innerHTML = `
      <div class="cart">
        <div>
          <div class="cart-list glass">
            ${items.map((i, idx) => `
            <div class="cart-item" data-idx="${idx}">
              <img src="${esc(i.image_url)}" alt="${esc(i.name)}">
              <div><h3>${esc(i.name)}</h3>
                <p class="meta">${esc([i.options?.colour, i.options?.storage, i.options?.protection && i.options.protection !== "Prism Care" ? i.options.protection : i.options?.protection ? "Prism Care included" : ""].filter(Boolean).join(" · "))}</p>
                <div class="qty"><button type="button" data-q="-1" aria-label="Decrease"><svg class="ic sm"><use href="#i-minus"/></svg></button><span>${i.qty}</span><button type="button" data-q="1" aria-label="Increase"><svg class="ic sm"><use href="#i-plus"/></svg></button></div>
              </div>
              <div class="right"><div class="price">${money(Number(i.unit_price) * i.qty)}</div><button type="button" class="remove" data-rm="1"><svg class="ic sm"><use href="#i-trash"/></svg> Remove</button></div>
            </div>`).join("")}
          </div>
          <div class="cart-note glass"><svg class="ic"><use href="#i-truck"/></svg><span>You've unlocked <b style="color:#fff">free 48h express delivery</b>. Order in the next 3h 12m to receive it by Thursday.</span></div>
          <a href="shop.html" class="link mt-2" style="display:inline-flex"><svg class="ic sm" style="transform:rotate(180deg)"><use href="#i-arrow"/></svg> Continue shopping</a>
        </div>
        <aside class="summary glass">
          <h3>Order summary</h3>
          <div class="row"><span>Subtotal (${items.reduce((s, i) => s + i.qty, 0)} items)</span><span>${DB.money2(t.subtotal)}</span></div>
          ${t.discount ? `<div class="row"><span>Promo ${esc(t.code)}</span><span class="free">− ${DB.money2(t.discount)}</span></div>` : ""}
          <div class="row"><span>Shipping</span><span class="free">Free</span></div>
          <div class="row"><span>Estimated tax</span><span>${DB.money2(t.tax)}</span></div>
          <div class="promo"><svg class="ic sm" style="color:var(--faint)"><use href="#i-tag"/></svg><input type="text" id="promo-input" placeholder="Promo code (try PRISM10)" aria-label="Promo code" value="${esc(getPromo())}"><button type="button" class="btn btn-glass btn-sm" id="promo-apply">Apply</button></div>
          <div class="row total"><span>Total</span><span>${DB.money2(t.total)}</span></div>
          <p class="fin mt-1">or <b>${DB.money2(Math.round((t.total / 24) * 100) / 100)}/mo</b> for 24 months at 0% APR</p>
          <a href="checkout.html" class="btn btn-primary btn-block btn-lg mt-2">Checkout <svg class="ic"><use href="#i-arrow"/></svg></a>
          <div class="secure"><svg class="ic sm"><use href="#i-lock"/></svg> 256-bit encrypted · Pay in 3 available</div>
        </aside>
      </div>`;
    }
    root.addEventListener("click", (e) => {
      const itemEl = e.target.closest(".cart-item");
      if (itemEl) {
        const idx = Number(itemEl.dataset.idx);
        const q = e.target.closest("[data-q]");
        if (q) { const it = DB.cart.get()[idx]; DB.cart.updateQty(idx, it.qty + Number(q.dataset.q)); render(); return; }
        if (e.target.closest("[data-rm]")) { DB.cart.remove(idx); toast("Item removed"); render(); return; }
      }
      if (e.target.closest("#promo-apply")) {
        const code = $("#promo-input").value.trim().toUpperCase();
        if (PROMO[code]) { localStorage.setItem("prism_promo", code); toast("Promo applied — 10% off", "ok"); }
        else { localStorage.removeItem("prism_promo"); if (code) toast("Invalid promo code", "error"); }
        render();
      }
    });
    render();
  }

  // ---------------------------------------------------------------- checkout
  async function initCheckout() {
    const summary = $("#checkout-summary");
    if (!summary) return;
    const items = DB.cart.get();
    if (!items.length) { location.replace("cart.html"); return; }

    const s = await DB.session().catch(() => null);
    if (!s?.user) { location.replace("login.html?next=checkout.html"); return; }
    if ($("#fn") && s.user.full_name) { const parts = String(s.user.full_name).split(" "); $("#fn").value = parts[0] || ""; $("#ln").value = parts.slice(1).join(" ") || ""; }
    if ($("#em")) $("#em").value = s.user.email || "";
    if ($("#ph") && s.user.phone) $("#ph").value = s.user.phone;
    const chip = $("#checkout-user");
    if (chip) { chip.hidden = false; chip.innerHTML = `<svg class="ic sm" style="color:var(--green)"><use href="#i-check"/></svg> Ordering as <b>${esc(s.user.email)}</b> · <a href="#" id="checkout-signout" class="link" style="font-size:inherit">sign out</a>`; $("#checkout-signout").addEventListener("click", async (e) => { e.preventDefault(); await DB.signOut(); location.reload(); }); }

    function shipCost() { const r = $("input[name=del]:checked"); return Number(r ? r.dataset.ship : 0); }
    function method() { const r = $("input[name=del]:checked"); return r ? r.dataset.method : "express"; }
    function payMethod() { const r = $("input[name=pay]:checked"); return r ? r.dataset.method : "card"; }
    const paymentFields = $("#payment-card-fields");
    function syncPaymentFields() {
      if (paymentFields) paymentFields.hidden = payMethod() === "cash_on_delivery";
    }
    $$('input[name="pay"]').forEach((input) => input.addEventListener("change", syncPaymentFields));
    syncPaymentFields();

    function renderSummary() {
      const t = totals(items, shipCost());
      summary.innerHTML = `
        <h3>Your order</h3>
        <div class="mini-items">
          ${items.map((i) => `<div class="mini"><img src="${esc(i.image_url)}" alt=""><div><b>${esc(i.name)}</b><small>${esc([i.options?.storage, i.options?.colour].filter(Boolean).join(" · ") || "Standard")} · ×${i.qty}</small></div><span class="amt">${money(Number(i.unit_price) * i.qty)}</span></div>`).join("")}
        </div>
        <div class="row"><span>Subtotal</span><span>${DB.money2(t.subtotal)}</span></div>
        ${t.discount ? `<div class="row"><span>Promo ${esc(t.code)}</span><span class="free">− ${DB.money2(t.discount)}</span></div>` : ""}
        <div class="row"><span>${esc(method()[0].toUpperCase() + method().slice(1))} delivery</span><span class="${t.shipping ? "" : "free"}">${t.shipping ? DB.money2(t.shipping) : "Free"}</span></div>
        <div class="row"><span>Tax</span><span>${DB.money2(t.tax)}</span></div>
        <div class="row total"><span>Total</span><span>${DB.money2(t.total)}</span></div>
        <button class="btn btn-primary btn-block btn-lg mt-2" id="place-order"><svg class="ic"><use href="#i-lock"/></svg> Place order</button>
        <div class="secure"><svg class="ic sm"><use href="#i-shield"/></svg> 30-day returns · 2-year Prism Care</div>`;
      $("#place-order").addEventListener("click", placeOrder);
    }

    async function placeOrder() {
      const activeSession = await DB.session().catch(() => null);
      if (!activeSession?.user) { location.assign("login.html?next=checkout.html"); return; }
      const need = [["#fn", "first name"], ["#ln", "last name"], ["#em", "email"], ["#ad", "street address"], ["#ci", "city"], ["#zp", "postcode"]];
      for (const [sel, label] of need) {
        const el = $(sel);
        if (!el.value.trim()) { toast("Please enter your " + label, "error"); el.focus(); el.classList.add("bad"); return; }
        el.classList.remove("bad");
      }
      const em = $("#em").value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { toast("Please enter a valid email", "error"); $("#em").focus(); return; }
      if (payMethod() === "card") {
        const cn = $("#cn").value.replace(/\s/g, "");
        if (cn.length < 12) { toast("Please enter your card number", "error"); $("#cn").focus(); return; }
      }
      const btn = $("#place-order");
      btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Placing order…';
      const t = totals(items, shipCost());
      try {
        const orderData = {
          subtotal: t.subtotal, discount: t.discount, shipping: t.shipping, tax: t.tax, total: t.total,
          promo_code: t.code || "", delivery_method: method(), payment_method: payMethod(),
          contact_name: ($("#fn").value + " " + $("#ln").value).trim(), contact_email: em, contact_phone: $("#ph").value.trim(),
          address: $("#ad").value.trim(), city: $("#ci").value.trim(), postcode: $("#zp").value.trim(),
          country: $("#co").value
        };
        const res = await DB.placeOrder(orderData, items.map((i) => ({
          product_id: i.product_id, name: i.name, brand: i.brand, image_url: i.image_url,
          options: i.options || {}, unit_price: Number(i.unit_price), qty: i.qty,
          line_total: Math.round(Number(i.unit_price) * i.qty * 100) / 100
        })));
        localStorage.setItem("prism_last_order", JSON.stringify(res));
        DB.cart.clear();
        localStorage.removeItem("prism_promo");
        location.assign("success.html");
      } catch (err) {
        console.error(err);
        toast(err.message || "Could not place order", "error");
        btn.disabled = false; btn.innerHTML = '<svg class="ic"><use href="#i-lock"/></svg> Place order';
      }
    }

    $$("input[name=del]").forEach((r) => r.addEventListener("change", renderSummary));
    // live credit-card preview
    const ccNum = $("#cn"), ccName = $("#ch"), ccExp = $("#ex");
    const pv = { num: $("#cc-num"), name: $("#cc-name"), exp: $("#cc-exp") };
    function paintCard() {
      if (pv.num) pv.num.textContent = (ccNum.value.replace(/\s/g, "").padEnd(16, "•").slice(0, 16).replace(/(.{4})/g, "$1 ").trim()) || "4242 •••• •••• 4242";
      if (pv.name) pv.name.textContent = (ccName.value || "YOUR NAME").toUpperCase();
      if (pv.exp) pv.exp.textContent = ccExp.value || "MM / YY";
    }
    [ccNum, ccName, ccExp].forEach((el) => el && el.addEventListener("input", paintCard));
    paintCard();
    renderSummary();
  }

  // ---------------------------------------------------------------- success
  async function initSuccess() {
    const el = $("#success-number");
    if (!el) return;
    let last = null;
    try { last = JSON.parse(localStorage.getItem("prism_last_order") || "null"); } catch (e) { }
    let order = null;
    if (last && last.id) order = await DB.getOrder(last.id).catch(() => null);
    const num = (order && order.order_number) || (last && last.order_number) || "PR-00000";
    el.textContent = "ORDER #" + num;
    const status = order ? order.status : "pending";
    const stepDone = { pending: 2, processing: 2, shipped: 3, delivered: 4, cancelled: 1 }[status] || 2;
    const steps = ["Order placed", "Payment confirmed", "Packed", "Delivered Thu"];
    $("#success-steps").innerHTML = steps.map((s2, i) => `<div class="${i < stepDone ? "done" : ""}">${s2}</div>`).join("");
    const name = order && order.contact_name ? order.contact_name.split(" ")[0] : null;
    if (name) $("#success-title").textContent = `Thank you, ${name}!`;
    if (status === "cancelled") $("#success-title").textContent = "Order cancelled";
  }

  // ---------------------------------------------------------------- login
  function initLogin() {
    const form = $("#auth-form");
    if (!form) return;
    if (DB.mode === "demo") $("#auth-demo-note").hidden = false;
    let tab = "signin";
    function paint() {
      $$("#auth-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
      $("#auth-submit").textContent = tab === "signin" ? "Sign in" : "Create account";
      $("#au-name-field").style.display = tab === "signup" ? "" : "none";
      $("#auth-error").hidden = true;
    }
    $$("#auth-tabs button").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; paint(); }));
    paint();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("#au-email").value.trim(), pass = $("#au-pass").value, name = $("#au-name").value.trim();
      const errEl = $("#auth-error");
      if (!email || !pass) { errEl.textContent = "Enter your email and password."; errEl.hidden = false; return; }
      const btn = $("#auth-submit"); btn.disabled = true; btn.textContent = "One moment…";
      try {
        let res;
        if (tab === "signin") res = await DB.signIn(email, pass);
        else res = await DB.signUp(email, pass, name);
        const sess = await DB.session();
        if (!sess && tab === "signup") {
          // Supabase email confirmation is enabled — no session until the link is clicked
          btn.disabled = false;
          paint();
          errEl.style.background = "rgba(52,211,153,.12)";
          errEl.style.borderColor = "rgba(52,211,153,.35)";
          errEl.style.color = "var(--green)";
          errEl.textContent = "Account created — check your inbox to confirm your email, then sign in.";
          errEl.hidden = false;
          return;
        }
        const role = sess?.user?.role || (res?.user?.role);
        const next = params.get("next");
        if (role === "admin") location.assign(next || "admin.html");
        else location.assign(next === "admin.html" ? "account.html" : next || "account.html");
      } catch (err) {
        errEl.textContent = err.message || "Something went wrong.";
        errEl.hidden = false;
        btn.disabled = false; paint();
      }
    });
  }

  // ---------------------------------------------------------------- account
  async function initAccount() {
    const root = $("#account-root");
    if (!root) return;
    root.innerHTML = '<div class="sk" style="height:220px;border-radius:22px"></div>';
    const s = await DB.session().catch(() => null);
    if (!s || !s.user) { location.replace("login.html?next=account.html"); return; }
    const u = s.user;
    const orders = await DB.listOrders({ userId: u.id }).catch(() => []);
    root.innerHTML = `
      <div class="form-card glass" style="margin:0">
        <h3><svg class="ic" style="color:var(--cyan)"><use href="#i-user"/></svg> Profile ${u.role === "admin" ? '<span class="st st-processing" style="margin-left:auto">Admin</span>' : ""}</h3>
        <div class="fgrid">
          <div class="field full"><label for="ac-name">Full name</label><input id="ac-name" type="text" value="${esc(u.full_name || "")}"></div>
          <div class="field full"><label for="ac-email">Email</label><input id="ac-email" type="email" value="${esc(u.email || "")}" disabled></div>
          <div class="field full"><label for="ac-phone">Phone</label><input id="ac-phone" type="tel" value="${esc(u.phone || "")}"></div>
        </div>
        <button class="btn btn-primary mt-2" id="ac-save">Save profile</button>
        <button class="btn btn-glass mt-2" id="ac-out" style="margin-left:8px">Sign out</button>
        ${u.role === "admin" ? '<a class="btn btn-glass mt-2" href="admin.html" style="margin-left:8px">Admin panel</a>' : ""}
      </div>
      <div>
        <h3 style="margin-bottom:14px">Order history</h3>
        ${orders.length ? orders.map((o) => `
          <div class="order-card glass">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
              <b style="font-family:'Courier New',monospace">${esc(o.order_number || "")}</b>${UI.stBadge(o.status)}
              <span class="muted" style="margin-left:auto;font-size:.85rem">${DB.fmtDate(o.created_at)}</span>
            </div>
            <div class="muted" style="font-size:.9rem">${(o.items || []).length ? (o.items || []).map((i) => `${esc(i.name)} ×${i.qty}`).join(", ") : "Details in confirmation email"}</div>
            <div style="display:flex;align-items:center;gap:12px"><b style="font-size:1.15rem">${DB.money2(o.total)}</b>${o.tracking_code ? `<span class="muted" style="font-size:.85rem">Tracking: ${esc(o.tracking_code)}</span>` : ""}</div>
          </div>`).join("") : '<div class="empty glass"><p class="muted">No orders yet.</p><a href="shop.html" class="btn btn-primary mt-2">Start shopping</a></div>'}
      </div>`;
    // customer-facing order list needs items — live getOrder includes them per order
    if (DB.mode === "live" && orders.length && !orders[0].items) {
      for (const card of $$(".order-card", root)) { /* items omitted in list view for brevity */ }
    }
    $("#ac-save").addEventListener("click", async () => {
      try {
        await DB.updateProfile(u.id, { full_name: $("#ac-name").value.trim(), phone: $("#ac-phone").value.trim() });
        toast("Profile saved", "ok");
      } catch (err) { toast(err.message || "Could not save", "error"); }
    });
    $("#ac-out").addEventListener("click", async () => { await DB.signOut(); location.assign("index.html"); });
  }

  // ---------------------------------------------------------------- contact
  async function initContact() {
    const form = $("#contact-form");
    if (!form) return;
    try {
      const settings = await DB.getStoreSettings();
      $("#store-company-name").textContent = settings.company_name;
      $("#store-phone").textContent = settings.phone;
      $("#store-email").textContent = settings.email;
      $("#store-hours").textContent = settings.contact_hours;
      const address = [settings.address, settings.city, settings.region, settings.postal_code, settings.country].filter(Boolean).join(", ");
      $("#store-address").textContent = address;
      $("#store-map").setAttribute("aria-label", "Company address: " + address);
    } catch (err) { console.error("Could not load store settings", err); }
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = { name: $("#cfn").value.trim(), email: $("#cem").value.trim(), topic: $("#ctp").value, message: $("#cms").value.trim() };
      if (!payload.name || !payload.email || !payload.message) return toast("Please fill in your name, email and message", "error");
      const btn = $("#contact-send");
      btn.disabled = true;
      try { await DB.sendMessage(payload); form.reset(); toast("Message sent — we reply within one business day", "ok"); }
      catch (err) { toast(err.message || "Could not send message", "error"); }
      btn.disabled = false;
    });
  }

  // ---------------------------------------------------------------- boot
  const INIT = { home: initHome, shop: initShop, product: initProduct, compare: initCompare, cart: initCart, checkout: initCheckout, success: initSuccess, login: initLogin, account: initAccount, contact: initContact };

  let activePage = "";

  async function renderPage() {
    const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    const page = target && target.matches("main section.page") ? target.id : $("#home.page") ? "home" : $("main section.page")?.id || "";
    if (page === activePage) return;
    activePage = page;
    if (INIT[page]) {
      try { await INIT[page](); }
      catch (err) { console.error(err); toast(err.message || "Something went wrong", "error"); }
    }
    paintWishes();
  }

  async function boot() {
    updateCartBadge();
    updateAccountBtn();
    DB.onAuth && DB.onAuth(() => { updateAccountBtn(); });
    window.addEventListener("hashchange", renderPage);
    await renderPage();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
