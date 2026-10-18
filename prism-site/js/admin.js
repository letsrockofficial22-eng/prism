// ============================================================================
// PRISM — admin panel (admin.html). Hash-routed SPA:
//   #/dashboard · #/orders · #/products · #/users · #/messages
// Guarded: live mode requires a signed-in profile with role = 'admin'.
// ============================================================================
(function () {
  "use strict";
  const DB = window.PrismDB;
  const { esc, toast, stBadge, statuses } = window.UI;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const money = (n) => DB.money2(n);
  let ME = null;

  const VIEWS = {
    "#/dashboard": { title: "Dashboard", render: renderDashboard },
    "#/orders": { title: "Orders", render: renderOrders },
    "#/products": { title: "Products", render: renderProducts },
    "#/users": { title: "Users", render: renderUsers },
    "#/messages": { title: "Messages", render: renderMessages },
    "#/settings": { title: "Store settings", render: renderSettings }
  };

  // ---------------------------------------------------------------- modal
  function openModal(title, body, wide) {
    closeModal();
    const back = document.createElement("div");
    back.className = "modal-back";
    back.id = "modal-back";
    back.innerHTML = `<div class="modal glass ${wide ? "wide" : ""}" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" id="modal-x" aria-label="Close"><svg class="ic sm"><use href="#i-x"/></svg></button></div>
      <div class="modal-body">${body}</div></div>`;
    document.body.appendChild(back);
    back.addEventListener("click", (e) => { if (e.target === back) closeModal(); });
    $("#modal-x").addEventListener("click", closeModal);
    document.addEventListener("keydown", escClose);
    return back.querySelector(".modal-body");
  }
  function escClose(e) { if (e.key === "Escape") closeModal(); }
  function closeModal() { const m = $("#modal-back"); if (m) m.remove(); document.removeEventListener("keydown", escClose); }

  // ---------------------------------------------------------------- guard
  async function guard() {
    const g = $("#admin-guard");
    g.hidden = false;
    g.innerHTML = '<div class="guard-box glass"><span class="spin lg"></span><p class="muted mt-1">Checking access…</p></div>';
    const s = await DB.session().catch(() => null);
    if (!s || !s.user) {
      g.innerHTML = `<div class="guard-box glass"><span class="eyebrow">Admin panel</span><h2 class="mt-1">Sign in required</h2><p class="muted mt-1">Use the owner account to manage Prism.</p><a class="btn btn-primary btn-lg mt-2" href="login.html?next=admin.html">Sign in <svg class="ic"><use href="#i-arrow"/></svg></a></div>`;
      return false;
    }
    const p = await DB.refreshRole ? await DB.refreshRole() : s.user;
    const role = p?.role || s.user.role;
    if (role !== "admin") {
      const message = DB.mode === "demo"
        ? `You're signed in as <b>${esc(s.user.email)}</b>. Sign in with the demo owner account to access admin tools.`
        : `You're signed in as <b>${esc(s.user.email)}</b>. Promote this account by running the SQL in README-SETUP.md (step 6), then reload.`;
      g.innerHTML = `<div class="guard-box glass"><span class="eyebrow">Access denied</span><h2 class="mt-1">Not an admin yet</h2><p class="muted mt-1">${message}</p><button class="btn btn-glass mt-2" id="guard-out">Sign out</button></div>`;
      $("#guard-out").addEventListener("click", async () => { await DB.signOut(); location.assign("login.html?next=admin.html"); });
      return false;
    }
    ME = Object.assign({}, s.user, { role: "admin", profile: p });
    g.hidden = true;
    return true;
  }

  // ---------------------------------------------------------------- shell
  function paintShell(route) {
    $$(".admin-nav a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === route));
    $("#admin-title").textContent = (VIEWS[route] || VIEWS["#/dashboard"]).title;
    const chip = $("#admin-user");
    if (chip && ME) chip.innerHTML = `<span class="avatar" style="width:34px;height:34px;font-size:.8rem">${esc((ME.full_name || ME.email || "A").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase())}</span><span><b>${esc(ME.full_name || "Owner")}</b><small>${esc(ME.email || "")}</small></span>`;
    $("#mode-badge").innerHTML = DB.mode === "live"
      ? '<span class="st st-delivered">Live · Supabase</span>'
      : '<span class="st st-pending">Demo · browser data</span>';
  }

  async function route() {
    let h = location.hash || "#/dashboard";
    if (!VIEWS[h]) h = "#/dashboard";
    paintShell(h);
    // fresh node each time so per-view listeners never leak across routes
    const old = $("#admin-view");
    const view = document.createElement("div");
    view.id = "admin-view";
    old.replaceWith(view);
    view.innerHTML = '<div class="sk" style="height:280px;border-radius:22px"></div>';
    try { await VIEWS[h].render(view); }
    catch (err) { console.error(err); view.innerHTML = `<div class="empty glass"><h3>Something went wrong</h3><p class="muted mt-1">${esc(err.message || "")}</p></div>`; }
  }

  // ---------------------------------------------------------------- dashboard
  async function renderDashboard(view) {
    const s = await DB.adminStats();
    const maxRev = Math.max(...s.days.map((d) => d.revenue), 1);
    view.innerHTML = `
      <div class="a-cards">
        <div class="a-card glass"><span class="a-ic" style="--c:var(--green)"><svg class="ic"><use href="#i-tag"/></svg></span><b>${money(s.revenue)}</b><span>Total revenue</span><small class="muted">${s.ordersCount - s.byStatus.cancelled} paid orders</small></div>
        <div class="a-card glass"><span class="a-ic" style="--c:var(--cyan)"><svg class="ic"><use href="#i-cart"/></svg></span><b>${s.ordersCount}</b><span>Orders</span><small class="muted">${s.pendingCount} awaiting action</small></div>
        <div class="a-card glass"><span class="a-ic" style="--c:var(--violet)"><svg class="ic"><use href="#i-user"/></svg></span><b>${s.usersCount}</b><span>Customers</span><small class="muted">${s.users.filter((u) => u.role === "admin").length} admins</small></div>
        <div class="a-card glass"><span class="a-ic" style="--c:var(--pink)"><svg class="ic"><use href="#i-phone"/></svg></span><b>${s.productsCount}</b><span>Products</span><small class="muted">${s.lowStock.length} low on stock</small></div>
      </div>

      <div class="a-grid2">
        <div class="glass a-panel">
          <div class="a-panel-head"><h3>Revenue · last 14 days</h3><span class="muted">${money(s.days.reduce((a, d) => a + d.revenue, 0))}</span></div>
          <div class="chart">${s.days.map((d) => `<div class="chart-col" title="${esc(d.label)}: ${money(d.revenue)} · ${d.count} orders"><i style="height:${Math.max(2, (d.revenue / maxRev) * 100)}%"></i><small>${esc(d.label.split(" ")[1])}</small></div>`).join("")}</div>
        </div>
        <div class="glass a-panel">
          <div class="a-panel-head"><h3>Orders by status</h3><a href="#/orders" class="link" style="font-size:.85rem">Manage <svg class="ic sm"><use href="#i-arrow"/></svg></a></div>
          ${statuses.map((st) => {
            const n = s.byStatus[st] || 0;
            const pct = s.ordersCount ? Math.round((n / s.ordersCount) * 100) : 0;
            return `<div class="stat-row"><span>${stBadge(st)}</span><div class="bar"><i style="width:${pct}%"></i></div><b>${n}</b></div>`;
          }).join("")}
          ${s.lowStock.length ? `<div class="a-panel-head mt-2"><h3>Low stock</h3></div>${s.lowStock.map((p) => `<div class="stat-row"><span class="muted">${esc(p.name)}</span><b style="color:${p.stock <= 0 ? "var(--red)" : "var(--amber)"}">${p.stock} left</b></div>`).join("")}` : ""}
        </div>
      </div>

      <div class="glass a-panel">
        <div class="a-panel-head"><h3>Latest orders</h3><a href="#/orders" class="link" style="font-size:.85rem">View all <svg class="ic sm"><use href="#i-arrow"/></svg></a></div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Total</th><th>Status</th><th></th></tr></thead>
          <tbody>${s.orders.slice(0, 6).map((o) => `<tr>
            <td class="mono">${esc(o.order_number || "")}</td>
            <td class="muted">${DB.fmtDateTime(o.created_at)}</td>
            <td>${esc(o.contact_name || "—")}<br><small class="muted">${esc(o.contact_email || "")}</small></td>
            <td><b>${money(o.total)}</b></td>
            <td>${stBadge(o.status)}</td>
            <td><a class="link" href="#/orders" data-open-order="${esc(o.id)}">Open <svg class="ic sm"><use href="#i-arrow"/></svg></a></td>
          </tr>`).join("")}</tbody>
        </table></div>
      </div>`;
    view.addEventListener("click", (e) => {
      const a = e.target.closest("[data-open-order]");
      if (a) { location.hash = "#/orders"; setTimeout(() => orderModal(a.dataset.openOrder), 350); }
    }, { once: true });
  }

  // ---------------------------------------------------------------- orders
  async function renderOrders(view) {
    const orders = await DB.listOrders();
    let filter = "all", q = "";
    function rows() {
      return orders.filter((o) => {
        if (filter !== "all" && o.status !== filter) return false;
        if (q) {
          const hay = [o.order_number, o.contact_name, o.contact_email, o.city].join(" ").toLowerCase();
          if (!hay.includes(q.toLowerCase())) return false;
        }
        return true;
      });
    }
    function paint() {
      const r = rows();
      $("#orders-body").innerHTML = r.length ? r.map((o) => `<tr>
          <td class="mono"><b>${esc(o.order_number || "")}</b><br><small class="muted">${DB.fmtDateTime(o.created_at)}</small></td>
          <td>${esc(o.contact_name || "Guest")}<br><small class="muted">${esc(o.contact_email || "")}</small></td>
          <td class="muted">${esc(o.city || "")}${o.country ? ", " + esc(o.country) : ""}</td>
          <td><b>${money(o.total)}</b><br><small class="muted">${esc(o.payment_method || "")}</small></td>
          <td>${stBadge(o.status)}</td>
          <td style="text-align:right"><button class="btn btn-glass btn-sm" data-view="${esc(o.id)}">Manage</button></td>
        </tr>`).join("") : '<tr><td colspan="6" class="muted" style="text-align:center;padding:36px">No orders match.</td></tr>';
      $("#orders-count").textContent = `${r.length} order${r.length === 1 ? "" : "s"}`;
    }
    view.innerHTML = `
      <div class="a-toolbar glass">
        <div class="chipbar">${["all", ...statuses].map((st) => `<button class="fchip ${st === filter ? "on" : ""}" data-f="${st}">${st === "all" ? "All" : st[0].toUpperCase() + st.slice(1)}${st !== "all" ? ` <b>${orders.filter((o) => o.status === st).length}</b>` : ""}</button>`).join("")}</div>
        <label class="search-pill" style="width:240px"><svg class="ic sm"><use href="#i-search"/></svg><input type="search" id="orders-q" placeholder="Search orders…"></label>
      </div>
      <div class="glass a-panel">
        <div class="a-panel-head"><h3>All orders</h3><span class="muted" id="orders-count"></span></div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Order</th><th>Customer</th><th>Ship to</th><th>Total</th><th>Status</th><th></th></tr></thead>
          <tbody id="orders-body"></tbody>
        </table></div>
      </div>`;
    paint();
    view.addEventListener("click", (e) => {
      const f = e.target.closest("[data-f]");
      if (f) { filter = f.dataset.f; $$(".fchip", view).forEach((c) => c.classList.toggle("on", c === f)); paint(); return; }
      const v = e.target.closest("[data-view]");
      if (v) orderModal(v.dataset.view, paint);
    });
    $("#orders-q").addEventListener("input", (e) => { q = e.target.value.trim(); paint(); });
  }

  async function orderModal(id, onChanged) {
    const o = await DB.getOrder(id);
    if (!o) return toast("Order not found", "error");
    const items = o.items || [];
    const next = { pending: "processing", processing: "shipped", shipped: "delivered" }[o.status];
    const body = openModal("Order " + (o.order_number || ""), `
      <div class="order-detail">
        <div>
          <div class="od-status">
            ${stBadge(o.status)}
            ${next ? `<button class="btn btn-primary btn-sm" data-status="${next}">Mark ${next}</button>` : ""}
            ${o.status !== "cancelled" && o.status !== "delivered" ? '<button class="btn btn-glass btn-sm danger" data-status="cancelled">Cancel order</button>' : ""}
          </div>
          <div class="od-items">
            ${items.map((i) => `<div class="mini"><img src="${esc(i.image_url)}" alt=""><div><b>${esc(i.name)}</b><small>${esc([i.options?.colour, i.options?.storage, i.options?.protection].filter(Boolean).join(" · ") || "Standard")} · ×${i.qty}</small></div><span class="amt">${money(Number(i.unit_price) * i.qty)}</span></div>`).join("") || '<p class="muted">No items recorded.</p>'}
          </div>
          <div class="od-totals">
            <div class="row"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
            ${Number(o.discount) ? `<div class="row"><span>Discount ${esc(o.promo_code || "")}</span><span>− ${money(o.discount)}</span></div>` : ""}
            <div class="row"><span>Shipping (${esc(o.delivery_method || "")})</span><span>${Number(o.shipping) ? money(o.shipping) : "Free"}</span></div>
            <div class="row"><span>Tax</span><span>${money(o.tax)}</span></div>
            <div class="row total"><span>Total</span><span>${money(o.total)}</span></div>
            <div class="row"><span>Paid with</span><span>${esc(o.payment_method || "card")}</span></div>
          </div>
        </div>
        <div>
          <h4 class="od-h">Customer & shipping</h4>
          <p class="od-p"><b>${esc(o.contact_name || "Guest")}</b><br>${esc(o.contact_email || "")}${o.contact_phone ? "<br>" + esc(o.contact_phone) : ""}</p>
          <p class="od-p muted">${esc(o.address || "")}<br>${esc(o.city || "")} ${esc(o.postcode || "")}<br>${esc(o.country || "")}</p>
          ${o.user_id ? `<p class="od-p"><span class="st st-processing">Registered user</span></p>` : `<p class="od-p"><span class="st st-pending">Guest order</span></p>`}
          <h4 class="od-h">Tracking code</h4>
          <div class="od-row"><input type="text" id="od-track" class="tin" placeholder="1Z-…" value="${esc(o.tracking_code || "")}"><button class="btn btn-glass btn-sm" id="od-track-save">Save</button></div>
          <h4 class="od-h">Internal notes</h4>
          <textarea id="od-notes" class="tin" rows="3" placeholder="Notes only visible to admins…">${esc(o.notes || "")}</textarea>
          <div class="od-row"><button class="btn btn-glass btn-sm" id="od-notes-save">Save notes</button><button class="btn btn-glass btn-sm danger" id="od-delete" style="margin-left:auto">Delete order</button></div>
          <p class="muted" style="font-size:.8rem;margin-top:14px">Placed ${DB.fmtDateTime(o.created_at)} · updated ${DB.fmtDateTime(o.updated_at)}</p>
        </div>
      </div>`);

    body.addEventListener("click", async (e) => {
      const st = e.target.closest("[data-status]");
      if (st) {
        try { await DB.updateOrder(o.id, { status: st.dataset.status }); toast("Order marked " + st.dataset.status, "ok"); closeModal(); onChanged && onChanged(); route(); }
        catch (err) { toast(err.message || "Update failed", "error"); }
      }
      if (e.target.closest("#od-track-save")) {
        try { await DB.updateOrder(o.id, { tracking_code: $("#od-track").value.trim() }); toast("Tracking saved", "ok"); }
        catch (err) { toast(err.message || "Save failed", "error"); }
      }
      if (e.target.closest("#od-notes-save")) {
        try { await DB.updateOrder(o.id, { notes: $("#od-notes").value }); toast("Notes saved", "ok"); }
        catch (err) { toast(err.message || "Save failed", "error"); }
      }
      if (e.target.closest("#od-delete")) {
        if (!confirm("Delete this order permanently?")) return;
        try { await DB.deleteOrder(o.id); toast("Order deleted"); closeModal(); onChanged && onChanged(); route(); }
        catch (err) { toast(err.message || "Delete failed", "error"); }
      }
    });
  }

  // ---------------------------------------------------------------- products
  async function renderProducts(view) {
    const products = await DB.listProducts({ all: true });
    let q = "";
    function rows() {
      return products.filter((p) => !q || (p.name + " " + p.brand + " " + p.category).toLowerCase().includes(q.toLowerCase()));
    }
    function paint() {
      const r = rows();
      $("#prod-body").innerHTML = r.length ? r.map((p) => `<tr>
        <td><div class="prod-cell"><img src="${esc((p.images || [""])[0])}" alt=""><div><b>${esc(p.name)}</b><small class="muted">${esc(p.brand)} · ${esc(p.category)}</small></div></div></td>
        <td><b>${money(p.price)}</b>${p.compare_at_price ? `<br><small class="muted"><s>${money(p.compare_at_price)}</s></small>` : ""}</td>
        <td><span class="stock-pill ${p.stock <= 0 ? "out" : p.stock <= 10 ? "low" : ""}">${p.stock}</span></td>
        <td>${Number(p.rating || 0).toFixed(1)} ★<br><small class="muted">${Number(p.reviews_count || 0).toLocaleString()}</small></td>
        <td><label class="mini-switch"><input type="checkbox" data-feat="${esc(p.id)}" ${p.is_featured ? "checked" : ""}><span>Featured</span></label></td>
        <td><label class="mini-switch"><input type="checkbox" data-active="${esc(p.id)}" ${p.is_active ? "checked" : ""}><span>Visible</span></label></td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-glass btn-sm" data-edit="${esc(p.id)}">Edit</button>
          <button class="icon-btn danger sm" data-del="${esc(p.id)}" aria-label="Delete" style="margin-left:6px;width:36px;height:36px"><svg class="ic sm"><use href="#i-trash"/></svg></button>
        </td>
      </tr>`).join("") : '<tr><td colspan="7" class="muted" style="text-align:center;padding:36px">No products found.</td></tr>';
      $("#prod-count").textContent = `${r.length} product${r.length === 1 ? "" : "s"}`;
    }
    view.innerHTML = `
      <div class="a-toolbar glass">
        <label class="search-pill" style="width:260px"><svg class="ic sm"><use href="#i-search"/></svg><input type="search" id="prod-q" placeholder="Search products…"></label>
        <button class="btn btn-primary btn-sm" id="prod-new"><svg class="ic sm"><use href="#i-plus"/></svg> New product</button>
      </div>
      <div class="glass a-panel">
        <div class="a-panel-head"><h3>Catalogue</h3><span class="muted" id="prod-count"></span></div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Rating</th><th>Featured</th><th>Status</th><th></th></tr></thead>
          <tbody id="prod-body"></tbody>
        </table></div>
      </div>`;
    paint();
    $("#prod-q").addEventListener("input", (e) => { q = e.target.value.trim(); paint(); });
    $("#prod-new").addEventListener("click", () => productModal(null, paint));
    view.addEventListener("click", async (e) => {
      const ed = e.target.closest("[data-edit]");
      if (ed) { productModal(products.find((p) => p.id === ed.dataset.edit), paint); return; }
      const del = e.target.closest("[data-del]");
      if (del) {
        const p = products.find((x) => x.id === del.dataset.del);
        if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
        try { await DB.deleteProduct(p.id); toast("Product deleted"); route(); }
        catch (err) { toast(err.message || "Delete failed", "error"); }
      }
    });
    view.addEventListener("change", async (e) => {
      const f = e.target.closest("[data-feat]"), a = e.target.closest("[data-active]");
      try {
        if (f) { await DB.saveProduct({ id: f.dataset.feat, is_featured: f.checked }); toast(f.checked ? "Marked featured" : "Removed from featured", "ok"); }
        if (a) { await DB.saveProduct({ id: a.dataset.active, is_active: a.checked }); toast(a.checked ? "Now visible in store" : "Hidden from store", "ok"); }
      } catch (err) { toast(err.message || "Update failed", "error"); e.target.checked = !e.target.checked; }
    });
  }

  function productModal(p, onSaved) {
    p = p ? JSON.parse(JSON.stringify(p)) : { name: "", brand: "", category: "flagship", tagline: "", description: "", price: 0, compare_at_price: null, stock: 0, rating: 4.5, reviews_count: 0, badge: "", badge_style: "", colors: [], storage_options: [], specs: [], highlights: [], tags: [], images: [], is_featured: false, is_active: true };
    p.colors = p.colors || []; p.storage_options = p.storage_options || []; p.specs = p.specs || []; p.highlights = p.highlights || []; p.images = p.images || [];

    const body = openModal(p.id ? "Edit product" : "New product", `
      <form id="pform">
        <div class="fgrid">
          <div class="field"><label>Name *</label><input class="tin" name="name" required value="${esc(p.name)}"></div>
          <div class="field"><label>Brand *</label><input class="tin" name="brand" required value="${esc(p.brand)}"></div>
          <div class="field"><label>Category</label><select class="tin" name="category">${["flagship", "foldable", "mid-range", "budget", "accessory"].map((c) => `<option ${p.category === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
          <div class="field"><label>Badge text (New / Hot / Deal / -9%)</label><input class="tin" name="badge" value="${esc(p.badge || "")}"></div>
          <div class="field"><label>Badge style</label><select class="tin" name="badge_style">${["", "new", "hot", "deal"].map((c) => `<option value="${c}" ${(p.badge_style || "") === c ? "selected" : ""}>${c || "plain"}</option>`).join("")}</select></div>
          <div class="field"><label>Tags (comma separated: 5g, wireless-charging, foldable)</label><input class="tin" name="tags" value="${esc((p.tags || []).join(", "))}"></div>
          <div class="field"><label>Price (BDT) *</label><input class="tin" name="price" type="number" step="0.01" min="0" required value="${p.price}"></div>
          <div class="field"><label>Compare-at price (BDT)</label><input class="tin" name="compare_at_price" type="number" step="0.01" min="0" value="${p.compare_at_price ?? ""}"></div>
          <div class="field"><label>Stock *</label><input class="tin" name="stock" type="number" min="0" required value="${p.stock}"></div>
          <div class="field"><label>Rating (0–5)</label><input class="tin" name="rating" type="number" step="0.1" min="0" max="5" value="${p.rating ?? 4.5}"></div>
          <div class="field"><label>Reviews count</label><input class="tin" name="reviews_count" type="number" min="0" value="${p.reviews_count ?? 0}"></div>
          <div class="field" style="display:flex;gap:18px;align-items:flex-end;padding-bottom:8px">
            <label class="check"><input type="checkbox" name="is_featured" ${p.is_featured ? "checked" : ""}><span>Featured</span></label>
            <label class="check"><input type="checkbox" name="is_active" ${p.is_active ? "checked" : ""}><span>Visible</span></label>
          </div>
          <div class="field full"><label>Tagline</label><input class="tin" name="tagline" value="${esc(p.tagline || "")}"></div>
          <div class="field full"><label>Description</label><textarea class="tin" name="description" rows="3">${esc(p.description || "")}</textarea></div>
        </div>

        <h4 class="od-h">Images <small class="muted">(first image is the cover · upload or paste URLs)</small></h4>
        <div id="p-images" class="img-list">
          ${p.images.map((src, i) => imgRow(src, i)).join("")}
        </div>
        <div class="od-row">
          <input class="tin" id="p-img-url" placeholder="https://…image.jpg">
          <button type="button" class="btn btn-glass btn-sm" id="p-img-add">Add URL</button>
          <label class="btn btn-glass btn-sm" style="cursor:pointer">Upload file<input type="file" id="p-img-file" accept="image/*" hidden></label>
        </div>

        <h4 class="od-h">Colours</h4>
        <div id="p-colors">${p.colors.map((c, i) => `<div class="kv-row" data-i="${i}"><input class="tin" data-k="name" value="${esc(c.name)}" placeholder="Desert Titanium"><input class="tin" data-k="hex" value="${esc(c.hex)}" placeholder="#c9b59a"><button type="button" class="icon-btn danger sm kv-x" aria-label="Remove"><svg class="ic sm"><use href="#i-x"/></svg></button></div>`).join("")}</div>
        <button type="button" class="btn btn-glass btn-sm kv-add" data-add="colors">+ Add colour</button>

        <h4 class="od-h">Storage options</h4>
        <div id="p-storage">${p.storage_options.map((o, i) => `<div class="kv-row" data-i="${i}"><input class="tin" data-k="label" value="${esc(o.label)}" placeholder="256 GB"><input class="tin" data-k="delta" type="number" value="${o.delta || 0}" placeholder="+0"><button type="button" class="icon-btn danger sm kv-x" aria-label="Remove"><svg class="ic sm"><use href="#i-x"/></svg></button></div>`).join("")}</div>
        <button type="button" class="btn btn-glass btn-sm kv-add" data-add="storage">+ Add option</button>

        <h4 class="od-h">Specifications</h4>
        <div id="p-specs">${p.specs.map((s2, i) => `<div class="kv-row" data-i="${i}"><input class="tin" data-k="label" value="${esc(s2.label)}" placeholder="Display"><input class="tin" data-k="value" value="${esc(s2.value)}" placeholder="6.9in OLED, 120 Hz"><button type="button" class="icon-btn danger sm kv-x" aria-label="Remove"><svg class="ic sm"><use href="#i-x"/></svg></button></div>`).join("")}</div>
        <button type="button" class="btn btn-glass btn-sm kv-add" data-add="specs">+ Add spec</button>

        <h4 class="od-h">Highlights (overview tab)</h4>
        <div id="p-highlights">${p.highlights.map((h, i) => `<div class="kv-row" data-i="${i}"><select class="tin" data-k="icon" style="max-width:120px">${["cpu", "camera", "battery", "shield", "zap", "sparkle", "phone", "fold"].map((ic) => `<option ${h.icon === ic ? "selected" : ""}>${ic}</option>`).join("")}</select><input class="tin" data-k="title" value="${esc(h.title)}" placeholder="A18 Pro"><input class="tin" data-k="text" value="${esc(h.text)}" placeholder="6-core GPU…"><button type="button" class="icon-btn danger sm kv-x" aria-label="Remove"><svg class="ic sm"><use href="#i-x"/></svg></button></div>`).join("")}</div>
        <button type="button" class="btn btn-glass btn-sm kv-add" data-add="highlights">+ Add highlight</button>

        <div class="od-row mt-2" style="position:sticky;bottom:-28px;background:linear-gradient(transparent,rgba(10,13,31,.9) 30%);padding:18px 0 4px">
          <button type="submit" class="btn btn-primary" id="p-save"><svg class="ic sm"><use href="#i-check"/></svg> Save product</button>
          <button type="button" class="btn btn-glass" id="p-cancel" style="margin-left:auto">Cancel</button>
        </div>
      </form>`, true);

    function imgRow(src, i) {
      return `<div class="img-row" data-i="${i}"><img src="${esc(src)}" alt=""><input class="tin" data-k="url" value="${esc(src)}"><button type="button" class="icon-btn sm" data-up aria-label="Move up" ${i === 0 ? "disabled" : ""}><svg class="ic sm"><use href="#i-chev"/></svg></button><button type="button" class="icon-btn danger sm kv-x" aria-label="Remove image"><svg class="ic sm"><use href="#i-x"/></svg></button></div>`;
    }
    function repaintImages() { $("#p-images").innerHTML = p.images.map(imgRow).join(""); }

    body.addEventListener("click", async (e) => {
      if (e.target.closest("#p-cancel")) return closeModal();
      if (e.target.closest("#p-img-add")) {
        const v = $("#p-img-url").value.trim();
        if (v) { p.images.push(v); $("#p-img-url").value = ""; repaintImages(); }
        return;
      }
      const up = e.target.closest("[data-up]");
      if (up) { const i = Number(up.closest(".img-row").dataset.i); if (i > 0) { [p.images[i - 1], p.images[i]] = [p.images[i], p.images[i - 1]]; syncImgInputs(); repaintImages(); } return; }
      const x = e.target.closest(".img-row .kv-x");
      if (x) { syncImgInputs(); p.images.splice(Number(x.closest(".img-row").dataset.i), 1); repaintImages(); return; }
      const add = e.target.closest("[data-add]");
      if (add) {
        const kind = add.dataset.add;
        if (kind === "colors") p.colors.push({ name: "", hex: "#8b5cf6" });
        if (kind === "storage") p.storage_options.push({ label: "", delta: 0 });
        if (kind === "specs") p.specs.push({ label: "", value: "" });
        if (kind === "highlights") p.highlights.push({ icon: "sparkle", title: "", text: "" });
        syncKV(); paintKV(kind);
        return;
      }
      const kx = e.target.closest(".kv-row .kv-x");
      if (kx) {
        const row = kx.closest(".kv-row");
        const wrap = row.parentElement.id; // p-colors etc
        syncKV();
        const kind = { "p-colors": "colors", "p-storage": "storage_options", "p-specs": "specs", "p-highlights": "highlights" }[wrap];
        p[kind].splice(Number(row.dataset.i), 1);
        paintKV(kind === "storage_options" ? "storage" : kind);
      }
    });
    function syncImgInputs() { $$("#p-images .img-row").forEach((r) => { p.images[Number(r.dataset.i)] = $("input", r).value.trim(); }); }
    function syncKV() {
      const map = { "p-colors": "colors", "p-storage": "storage_options", "p-specs": "specs", "p-highlights": "highlights" };
      Object.entries(map).forEach(([elId, key]) => {
        $$("#" + elId + " .kv-row").forEach((r) => {
          const obj = p[key][Number(r.dataset.i)] || {};
          $$("input,select", r).forEach((inp) => { obj[inp.dataset.k] = inp.type === "number" ? Number(inp.value) : inp.value; });
          p[key][Number(r.dataset.i)] = obj;
        });
      });
    }
    function paintKV(kind) {
      if (kind === "colors") $("#p-colors").innerHTML = p.colors.map((c, i) => `<div class="kv-row" data-i="${i}"><input class="tin" data-k="name" value="${esc(c.name)}" placeholder="Desert Titanium"><input class="tin" data-k="hex" value="${esc(c.hex)}" placeholder="#c9b59a"><button type="button" class="icon-btn danger sm kv-x" aria-label="Remove"><svg class="ic sm"><use href="#i-x"/></svg></button></div>`).join("");
      if (kind === "storage") $("#p-storage").innerHTML = p.storage_options.map((o, i) => `<div class="kv-row" data-i="${i}"><input class="tin" data-k="label" value="${esc(o.label)}" placeholder="256 GB"><input class="tin" data-k="delta" type="number" value="${o.delta || 0}"><button type="button" class="icon-btn danger sm kv-x" aria-label="Remove"><svg class="ic sm"><use href="#i-x"/></svg></button></div>`).join("");
      if (kind === "specs") $("#p-specs").innerHTML = p.specs.map((s2, i) => `<div class="kv-row" data-i="${i}"><input class="tin" data-k="label" value="${esc(s2.label)}" placeholder="Display"><input class="tin" data-k="value" value="${esc(s2.value)}" placeholder="6.9in OLED"><button type="button" class="icon-btn danger sm kv-x" aria-label="Remove"><svg class="ic sm"><use href="#i-x"/></svg></button></div>`).join("");
      if (kind === "highlights") $("#p-highlights").innerHTML = p.highlights.map((h, i) => `<div class="kv-row" data-i="${i}"><select class="tin" data-k="icon" style="max-width:120px">${["cpu", "camera", "battery", "shield", "zap", "sparkle", "phone", "fold"].map((ic) => `<option ${h.icon === ic ? "selected" : ""}>${ic}</option>`).join("")}</select><input class="tin" data-k="title" value="${esc(h.title)}"><input class="tin" data-k="text" value="${esc(h.text)}"><button type="button" class="icon-btn danger sm kv-x" aria-label="Remove"><svg class="ic sm"><use href="#i-x"/></svg></button></div>`).join("");
    }

    $("#p-img-file", body).addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 4 * 1024 * 1024 && DB.mode === "demo") return toast("Demo uploads must be under 4 MB", "error");
      toast("Uploading image…");
      try { const url = await DB.uploadImage(file); p.images.push(url); repaintImages(); toast("Image uploaded", "ok"); }
      catch (err) { toast(err.message || "Upload failed", "error"); }
      e.target.value = "";
    });

    $("#pform", body).addEventListener("submit", async (e) => {
      e.preventDefault();
      syncImgInputs(); syncKV();
      const fd = new FormData(e.target);
      const prod = Object.assign({}, p, {
        name: fd.get("name").trim(), brand: fd.get("brand").trim(), category: fd.get("category"),
        tagline: fd.get("tagline"), description: fd.get("description"),
        price: Number(fd.get("price")), compare_at_price: fd.get("compare_at_price") ? Number(fd.get("compare_at_price")) : null,
        stock: Number(fd.get("stock")), rating: Number(fd.get("rating")), reviews_count: Number(fd.get("reviews_count")),
        badge: fd.get("badge"), badge_style: fd.get("badge_style"),
        tags: String(fd.get("tags")).split(",").map((t) => t.trim()).filter(Boolean),
        is_featured: !!fd.get("is_featured"), is_active: !!fd.get("is_active"),
        colors: p.colors.filter((c) => c.name), storage_options: p.storage_options.filter((o) => o.label),
        specs: p.specs.filter((s2) => s2.label), highlights: p.highlights.filter((h) => h.title),
        images: p.images.filter(Boolean)
      });
      if (!prod.slug && p.slug) prod.slug = p.slug;
      const btn = $("#p-save", body); btn.disabled = true;
      try {
        await DB.saveProduct(prod);
        toast("Product saved", "ok");
        closeModal(); onSaved && onSaved(); route();
      } catch (err) { toast(err.message || "Save failed", "error"); btn.disabled = false; }
    });
  }

  // ---------------------------------------------------------------- users
  async function renderUsers(view) {
    const users = await DB.listUsers();
    let subs = [];
    try { subs = await DB.listSubscribers(); } catch (e) { }
    view.innerHTML = `
      <div class="glass a-panel">
        <div class="a-panel-head"><h3>Registered users</h3><span class="muted">${users.length} total · ${users.filter((u) => u.role === "admin").length} admins</span></div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>User</th><th>Contact</th><th>Joined</th><th>Orders</th><th>Total spent</th><th>Last order</th><th>Role</th></tr></thead>
          <tbody>${users.map((u) => `<tr>
            <td><div class="prod-cell"><span class="avatar" style="width:36px;height:36px;font-size:.75rem">${esc((u.full_name || u.email || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase())}</span><div><b>${esc(u.full_name || "—")}</b>${u.id === (ME && ME.id) ? ' <small class="st st-delivered">you</small>' : ""}</div></div></td>
            <td>${esc(u.email || "")}${u.phone ? `<br><small class="muted">${esc(u.phone)}</small>` : ""}</td>
            <td class="muted">${DB.fmtDate(u.created_at)}</td>
            <td>${u.orders_count ?? 0}</td>
            <td><b>${money(u.total_spent || 0)}</b></td>
            <td class="muted">${u.last_order ? DB.fmtDate(u.last_order) : "—"}</td>
            <td><select class="tin role-sel" data-role-id="${esc(u.id)}" ${u.id === (ME && ME.id) ? "disabled" : ""}>
              <option value="customer" ${u.role !== "admin" ? "selected" : ""}>Customer</option>
              <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
            </select></td>
          </tr>`).join("") || '<tr><td colspan="7" class="muted" style="text-align:center;padding:36px">No users yet.</td></tr>'}</tbody>
        </table></div>
      </div>
      <div class="glass a-panel">
        <div class="a-panel-head"><h3>Newsletter subscribers</h3><span class="muted">${subs.length}</span></div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Email</th><th>Subscribed</th></tr></thead>
          <tbody>${subs.map((s2) => `<tr><td>${esc(s2.email)}</td><td class="muted">${DB.fmtDate(s2.created_at)}</td></tr>`).join("") || '<tr><td colspan="2" class="muted" style="text-align:center;padding:24px">No subscribers yet.</td></tr>'}</tbody>
        </table></div>
      </div>`;
    view.addEventListener("change", async (e) => {
      const sel = e.target.closest("[data-role-id]");
      if (!sel) return;
      try { await DB.setUserRole(sel.dataset.roleId, sel.value); toast("Role updated — user is now " + sel.value, "ok"); }
      catch (err) { toast(err.message || "Could not change role", "error"); route(); }
    });
  }

  // ---------------------------------------------------------------- messages
  async function renderMessages(view) {
    const msgs = await DB.listMessages();
    view.innerHTML = `
      <div class="glass a-panel">
        <div class="a-panel-head"><h3>Inbox</h3><span class="muted">${msgs.filter((m) => !m.handled).length} unhandled</span></div>
        <div class="msg-list">${msgs.length ? msgs.map((m) => `
          <div class="msg ${m.handled ? "handled" : ""}" data-id="${esc(m.id)}">
            <div class="msg-head">
              <span class="avatar" style="width:34px;height:34px;font-size:.72rem">${esc((m.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase())}</span>
              <div><b>${esc(m.name || "Anonymous")}</b><small class="muted">${esc(m.email || "")} · ${esc(m.topic || "")} · ${DB.fmtDateTime(m.created_at)}</small></div>
              ${m.handled ? '<span class="st st-delivered" style="margin-left:auto">Handled</span>' : '<span class="st st-pending" style="margin-left:auto">New</span>'}
            </div>
            <p class="muted">${esc(m.message || "")}</p>
            <div class="od-row">
              <button class="btn btn-glass btn-sm" data-toggle>${m.handled ? "Mark unhandled" : "Mark handled"}</button>
              <a class="btn btn-glass btn-sm" href="mailto:${esc(m.email || "")}?subject=Re: ${encodeURIComponent(m.topic || "Prism")}" style="margin-left:8px">Reply by email</a>
              <button class="btn btn-glass btn-sm danger" data-delm style="margin-left:auto">Delete</button>
            </div>
          </div>`).join("") : '<p class="muted" style="padding:30px;text-align:center">No messages yet — they appear here from the contact form.</p>'}
        </div>
      </div>`;
    view.addEventListener("click", async (e) => {
      const card = e.target.closest(".msg");
      if (!card) return;
      const id = card.dataset.id;
      const m = msgs.find((x) => x.id === id);
      if (e.target.closest("[data-toggle]")) { await DB.markMessage(id, !m.handled); route(); }
      if (e.target.closest("[data-delm]")) { if (confirm("Delete this message?")) { await DB.deleteMessage(id); toast("Message deleted"); route(); } }
    });
  }

  async function renderSettings(view) {
    const settings = await DB.getStoreSettings();
    view.innerHTML = `
      <form class="glass a-panel" id="store-settings-form">
        <div class="a-panel-head"><h3>Company and contact details</h3><span class="muted">Shown on the contact page</span></div>
        <div class="fgrid">
          <div class="field full"><label for="setting-company">Company name</label><input id="setting-company" name="company_name" required value="${esc(settings.company_name)}"></div>
          <div class="field full"><label for="setting-address">Street address</label><input id="setting-address" name="address" required value="${esc(settings.address)}"></div>
          <div class="field"><label for="setting-city">City</label><input id="setting-city" name="city" required value="${esc(settings.city)}"></div>
          <div class="field"><label for="setting-region">State or region</label><input id="setting-region" name="region" value="${esc(settings.region)}"></div>
          <div class="field"><label for="setting-postal">Postal code</label><input id="setting-postal" name="postal_code" value="${esc(settings.postal_code)}"></div>
          <div class="field"><label for="setting-country">Country</label><input id="setting-country" name="country" required value="${esc(settings.country)}"></div>
          <div class="field"><label for="setting-phone">Contact phone</label><input id="setting-phone" name="phone" type="tel" required value="${esc(settings.phone)}"></div>
          <div class="field"><label for="setting-email">Contact email</label><input id="setting-email" name="email" type="email" required value="${esc(settings.email)}"></div>
          <div class="field full"><label for="setting-hours">Contact / showroom hours</label><input id="setting-hours" name="contact_hours" value="${esc(settings.contact_hours)}"></div>
        </div>
        <button class="btn btn-primary mt-2" type="submit" id="settings-save">Save settings</button>
      </form>`;
    $("#store-settings-form", view).addEventListener("submit", async (e) => {
      e.preventDefault();
      const values = Object.fromEntries(new FormData(e.currentTarget).entries());
      const button = $("#settings-save", view);
      button.disabled = true;
      try { await DB.saveStoreSettings(values); toast("Store settings saved", "ok"); }
      catch (err) { toast(err.message || "Could not save settings", "error"); }
      finally { button.disabled = false; }
    });
  }

  // ---------------------------------------------------------------- boot
  async function boot() {
    const ok = await guard();
    if (!ok) return;
    $("#admin-signout").addEventListener("click", async () => { await DB.signOut(); location.assign("login.html?next=admin.html"); });
    $("#admin-refresh").addEventListener("click", () => route());
    window.addEventListener("hashchange", route);
    route();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
