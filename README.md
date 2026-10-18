# Prism Store — Supabase setup guide

The whole store (12 pages + admin panel) runs on **Supabase**: products, orders,
users, messages, newsletter subscribers and product images.

> **Right now the site is in DEMO MODE** (no credentials configured). Everything
> works — products, cart, checkout, order processing, the admin panel — but data
> is stored in your browser only. Follow the steps below to switch to a real
> Supabase backend. The amber "Demo mode" pill in the corner disappears once connected.

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Pick a name (e.g. `prism-store`), a strong database password, and a region near you.
3. Wait ~2 minutes for provisioning.

## 2. Run the schema

1. In your project, open **SQL Editor** → **New query**.
2. Copy the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and paste it in.
3. Click **Run**.

This creates, in one shot:

| Object | What it does |
|---|---|
| `profiles` | Mirrors auth users + `role` (`customer` / `admin`) |
| `products` | Catalogue: price, stock, colours, storage options, specs, images[] |
| `orders` + `order_items` | Orders with auto numbers (`PR-00001`), status flow |
| `messages` / `subscribers` | Contact form inbox / newsletter |
| `place_order()` RPC | Atomic checkout: order + items + stock decrement |
| Triggers | Auto-profile on signup, order numbers, role-escalation protection |
| RLS policies | Public reads products; customers see only their own orders; **admins can do everything** |
| `product-images` bucket | Public-read storage bucket for image uploads from the admin panel |
| Seed data | The 10 demo products from the storefront |

The script is idempotent — safe to run again. If you already connected a Supabase project, rerun the updated schema to add the store settings table and apply the signed-in-only checkout restriction. Product prices are now treated as BDT; existing numeric prices are kept as-is, with no exchange-rate conversion.

## 3. Configure auth URLs

**Authentication → URL Configuration**:

- **Site URL**: your deployed domain (or `http://localhost:8080` while developing).
- **Redirect URLs**: add every URL the site runs on, e.g.
  `http://localhost:8080/**`, your Netlify/Vercel/preview URLs, your production domain.

Optional but recommended for a smooth demo: **Authentication → Providers → Email →
turn OFF "Confirm email"** so new accounts can sign in immediately. (If you leave it
on, the site handles it — sign-up shows a "check your inbox" message.)

## 4. Connect the site

Open **Settings → API** in Supabase and copy:

- **Project URL** (e.g. `https://abcdefghijk.supabase.co`)
- **anon / public** key (the long JWT)

Paste them into [`js/config.js`](js/config.js):

```js
window.PRISM_CONFIG = {
  supabaseUrl: "https://abcdefghijk.supabase.co",
  supabaseAnonKey: "eyJhbGciOi…your-anon-key…"
};
```

Reload the site — the demo pill is gone and data now comes from Supabase.

> 🔒 The **anon key is safe to expose** — Row Level Security enforces permissions.
> Never put the `service_role` key in these files.

## 5. Create the owner (admin) account

1. Open **`login.html`** on your site → **Create account** → sign up with the owner's
   email and a password.
2. Go back to the Supabase **SQL Editor** and run:

   ```sql
   update public.profiles set role = 'admin' where email = 'owner@example.com';
   ```

3. Open **`admin.html`** — you're in. (The admin link is also in the site footer.)

Anyone you later promote from **Admin → Users → Role** gets the same access; no SQL needed
after this first bootstrap.

## 6. Deploy (any static host)

The site is pure static files — deploy the whole folder to Netlify, Vercel,
Cloudflare Pages, GitHub Pages, or any web server. After deploying, add the
production URL to **Redirect URLs** (step 3). No build step, no server code.

---

## What the admin panel does (`admin.html`)

| View | Capabilities |
|---|---|
| **Dashboard** | Revenue, orders, customers, product counts · 14-day revenue chart · orders by status · low-stock alerts · latest orders |
| **Orders** | Filter by status, search by number/email/city · open any order: items, customer, shipping · **advance status** (pending → processing → shipped → delivered), cancel, save tracking code & internal notes, delete |
| **Products** | Full CRUD: name, brand, category, price, compare-at price, stock, badge, tags, tagline, description, colours, storage options, specs, highlights · **change images: upload files (→ Supabase Storage) or paste URLs, reorder, set cover** · toggle Featured / Visible with one click |
| **Users** | Every registered user with join date, order count, total spent, last order · **promote/demote admins** · newsletter subscriber list |
| **Messages** | Contact-form inbox: mark handled, reply by email, delete |

Storefront features wired to Supabase: live product catalogue (home, shop filters/sort/
search/pagination, product pages with colour/storage/protection options, compare tool),
cart + promo code `PRISM10` (10% off), guest **or** account checkout via the
`place_order` RPC (stock decrements automatically), order confirmation with real order
numbers, customer accounts with order history, contact form, newsletter signup.

## Troubleshooting

- **"Admin access required"** → your profile isn't `role='admin'` yet (step 5), or you
  just promoted yourself and need to reload `admin.html`.
- **Sign-in redirects to login page** → your site URL isn't in **Redirect URLs** (step 3).
- **Images don't upload** → confirm the `product-images` bucket exists and is **public**
  (step 2 creates it; check under Storage).
- **Empty shop on a fresh project** → the seed products only insert on first run; check
  Table Editor → `products`, or re-run `schema.sql`.
- **Reset demo data** → clear the site's localStorage (DevTools → Application →
  Local Storage → clear `prism_demo_db_v1`, `prism_cart_v1`, `prism_demo_session_v1`).# prism
