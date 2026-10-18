// ============================================================================
// PRISM — shared UI helpers (toasts, badges, escaping). Used by app + admin.
// ============================================================================
(function () {
  "use strict";

  const UI = {};

  UI.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  UI.toast = function (msg, kind) {
    let root = document.getElementById("toasts");
    if (!root) {
      root = document.createElement("div");
      root.id = "toasts";
      document.body.appendChild(root);
    }
    const t = document.createElement("div");
    t.className = "toast glass-2" + (kind ? " toast-" + kind : "");
    t.innerHTML = (kind === "error" ? '<svg class="ic sm"><use href="#i-x"/></svg> ' : kind === "ok" ? '<svg class="ic sm" style="color:var(--green)"><use href="#i-check"/></svg> ' : "") + UI.esc(msg);
    root.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transform = "translateY(8px)"; setTimeout(() => t.remove(), 350); }, 2800);
  };

  const STATUS = {
    pending:    { label: "Pending",    cls: "st-pending" },
    processing: { label: "Processing", cls: "st-processing" },
    shipped:    { label: "Shipped",    cls: "st-shipped" },
    delivered:  { label: "Delivered",  cls: "st-delivered" },
    cancelled:  { label: "Cancelled",  cls: "st-cancelled" }
  };
  UI.stBadge = (s) => { const st = STATUS[s] || { label: s, cls: "" }; return `<span class="st ${st.cls}">${st.label}</span>`; };
  UI.statuses = Object.keys(STATUS);

  UI.stars = (rating) => `<span class="stars" style="--p:${Math.round((Number(rating) || 0) * 20)}%">★★★★★</span>`;

  UI.money = (n) => window.PrismDB ? PrismDB.money(n) : "$" + Number(n || 0);

  window.UI = UI;
})();
