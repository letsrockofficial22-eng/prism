-- ============================================================================
--  PRISM STORE — Supabase backend (run once in Supabase → SQL Editor)
--  Creates: tables, triggers, RPCs, RLS policies, storage bucket, seed data.
--  Safe to re-run (idempotent).
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. TABLES
-- ============================================================================

create sequence if not exists public.order_number_seq;

-- Mirror of auth.users exposed safely to the client (with role for admin)
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  full_name   text default '',
  phone       text default '',
  role        text not null default 'customer' check (role in ('customer','admin')),
  created_at  timestamptz not null default now()
);

create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique,
  name              text not null,
  brand             text not null default '',
  category          text not null default 'flagship'
                    check (category in ('flagship','foldable','mid-range','budget','accessory')),
  tagline           text default '',
  description       text default '',
  price             numeric(10,2) not null default 0,
  compare_at_price  numeric(10,2),
  stock             integer not null default 0,
  rating            numeric(2,1) default 4.5,
  reviews_count     integer default 0,
  badge             text default '',              -- 'New' | 'Hot' | 'Deal' | '-9%' | ''
  badge_style       text default '',              -- 'new' | 'hot' | 'deal' | ''
  colors            jsonb default '[]',           -- [{"name":"Desert Titanium","hex":"#c9b59a"}]
  storage_options   jsonb default '[]',           -- [{"label":"256 GB","delta":0}]
  specs             jsonb default '[]',           -- [{"label":"Display","value":"6.9in OLED"}]
  highlights        jsonb default '[]',           -- [{"icon":"cpu","title":"A18 Pro","text":"..."}]
  tags              text[] default '{}',          -- {5g,wireless-charging,foldable}
  images            text[] default '{}',          -- first image is the primary one
  is_featured       boolean default false,
  is_active         boolean default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text unique,
  user_id          uuid references auth.users on delete set null,
  status           text not null default 'pending'
                   check (status in ('pending','processing','shipped','delivered','cancelled')),
  subtotal         numeric(10,2) not null default 0,
  discount         numeric(10,2) not null default 0,
  shipping         numeric(10,2) not null default 0,
  tax              numeric(10,2) not null default 0,
  total            numeric(10,2) not null default 0,
  promo_code       text,
  delivery_method  text default 'express',
  payment_method   text default 'card',
  contact_name     text,
  contact_email    text,
  contact_phone    text,
  address          text,
  city             text,
  postcode         text,
  country          text,
  tracking_code    text,
  notes            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
create index if not exists orders_user_idx   on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);

create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders on delete cascade,
  product_id  uuid references public.products on delete set null,
  name        text not null,
  brand       text default '',
  image_url   text default '',
  options     jsonb default '{}',          -- {"colour":"Desert Titanium","storage":"256 GB"}
  unit_price  numeric(10,2) not null default 0,
  qty         integer not null default 1,
  line_total  numeric(10,2) not null default 0
);
create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  email       text,
  topic       text,
  message     text,
  handled     boolean default false,
  created_at  timestamptz default now()
);

create table if not exists public.subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  created_at  timestamptz default now()
);

create table if not exists public.store_settings (
  id            smallint primary key default 1 check (id = 1),
  company_name  text not null default 'Prism Mobile Ltd.',
  address       text not null default '',
  city          text not null default '',
  region        text not null default '',
  postal_code   text not null default '',
  country       text not null default 'Bangladesh',
  phone         text not null default '',
  email         text not null default '',
  contact_hours text not null default '',
  updated_at    timestamptz not null default now()
);

insert into public.store_settings (id, company_name, address, city, region, postal_code, country, phone, email, contact_hours)
values (1, 'Prism Mobile Ltd.', '412 Crystal Avenue', 'Austin', 'TX', '78701', 'United States', '+1 (555) 010-7746', 'hello@prismmobile.com', 'Mon–Sat 10 am – 8 pm · Sun 12 – 6 pm')
on conflict (id) do nothing;

-- ============================================================================
-- 2. FUNCTIONS + TRIGGERS
-- ============================================================================

-- admin check used by RLS (security definer so policies can read profiles)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- auto-create a profile row for every new auth user
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- stop customers from escalating their own role via the client
-- (auth.uid() is null for SQL-editor / service-role access, so the owner can
--  still promote admins manually)
create or replace function public.protect_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end; $$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_role();

-- human-friendly order numbers: PR-00001, PR-00002, ...
create or replace function public.set_order_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.order_number is null then
    new.order_number := 'PR-' || lpad(nextval('public.order_number_seq')::text, 5, '0');
  end if;
  return new;
end; $$;

drop trigger if exists orders_set_number on public.orders;
create trigger orders_set_number before insert on public.orders
  for each row execute function public.set_order_number();

-- keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- one-call checkout: creates the order + items and decrements stock atomically
create or replace function public.place_order(p_order jsonb, p_items jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid;
  v_item     jsonb;
  v_pid      uuid;
begin
  if auth.uid() is null then
    raise exception 'You must sign in or create an account before ordering';
  end if;

  insert into public.orders (
    user_id, subtotal, discount, shipping, tax, total, promo_code,
    delivery_method, payment_method, contact_name, contact_email, contact_phone,
    address, city, postcode, country, notes
  ) values (
    auth.uid(),
    coalesce((p_order->>'subtotal')::numeric, 0),
    coalesce((p_order->>'discount')::numeric, 0),
    coalesce((p_order->>'shipping')::numeric, 0),
    coalesce((p_order->>'tax')::numeric, 0),
    coalesce((p_order->>'total')::numeric, 0),
    nullif(p_order->>'promo_code',''),
    coalesce(nullif(p_order->>'delivery_method',''), 'express'),
    coalesce(nullif(p_order->>'payment_method',''), 'card'),
    p_order->>'contact_name', p_order->>'contact_email', p_order->>'contact_phone',
    p_order->>'address', p_order->>'city', p_order->>'postcode', p_order->>'country',
    nullif(p_order->>'notes','')
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    v_pid := nullif(v_item->>'product_id','')::uuid;
    insert into public.order_items
      (order_id, product_id, name, brand, image_url, options, unit_price, qty, line_total)
    values (
      v_order_id, v_pid,
      v_item->>'name',
      coalesce(v_item->>'brand',''),
      coalesce(v_item->>'image_url',''),
      coalesce(v_item->'options','{}'::jsonb),
      coalesce((v_item->>'unit_price')::numeric, 0),
      coalesce((v_item->>'qty')::int, 1),
      coalesce((v_item->>'line_total')::numeric, 0)
    );
    if v_pid is not null then
      update public.products
         set stock = greatest(stock - coalesce((v_item->>'qty')::int, 1), 0)
       where id = v_pid;
    end if;
  end loop;

  return v_order_id;
end; $$;

revoke execute on function public.place_order(jsonb, jsonb) from public, anon;
grant execute on function public.place_order(jsonb, jsonb) to authenticated;

-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles    enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.messages    enable row level security;
alter table public.subscribers enable row level security;
alter table public.store_settings enable row level security;

-- profiles ------------------------------------------------------------------
drop policy if exists "profiles select" on public.profiles;
create policy "profiles select" on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles insert" on public.profiles;
create policy "profiles insert" on public.profiles for insert
  with check (id = auth.uid());

drop policy if exists "profiles update" on public.profiles;
create policy "profiles update" on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- products ------------------------------------------------------------------
drop policy if exists "products select" on public.products;
create policy "products select" on public.products for select
  using (is_active or public.is_admin());

drop policy if exists "products admin insert" on public.products;
create policy "products admin insert" on public.products for insert
  with check (public.is_admin());

drop policy if exists "products admin update" on public.products;
create policy "products admin update" on public.products for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "products admin delete" on public.products;
create policy "products admin delete" on public.products for delete
  using (public.is_admin());

-- orders --------------------------------------------------------------------
drop policy if exists "orders select" on public.orders;
create policy "orders select" on public.orders for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "orders insert" on public.orders;
create policy "orders insert" on public.orders for insert
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "orders admin update" on public.orders;
create policy "orders admin update" on public.orders for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "orders admin delete" on public.orders;
create policy "orders admin delete" on public.orders for delete
  using (public.is_admin());

-- order_items ----------------------------------------------------------------
drop policy if exists "order_items select" on public.order_items;
create policy "order_items select" on public.order_items for select
  using (
    public.is_admin()
    or exists (select 1 from public.orders o
               where o.id = order_id and o.user_id = auth.uid())
  );

drop policy if exists "order_items insert" on public.order_items;
create policy "order_items insert" on public.order_items for insert
  with check (
    exists (select 1 from public.orders o
            where o.id = order_id
              and (o.user_id is null or o.user_id = auth.uid()))
  );

drop policy if exists "order_items admin update" on public.order_items;
create policy "order_items admin update" on public.order_items for update
  using (public.is_admin());

drop policy if exists "order_items admin delete" on public.order_items;
create policy "order_items admin delete" on public.order_items for delete
  using (public.is_admin());

-- messages --------------------------------------------------------------------
drop policy if exists "messages insert" on public.messages;
create policy "messages insert" on public.messages for insert with check (true);

drop policy if exists "messages admin select" on public.messages;
create policy "messages admin select" on public.messages for select
  using (public.is_admin());

drop policy if exists "messages admin update" on public.messages;
create policy "messages admin update" on public.messages for update
  using (public.is_admin());

-- subscribers ------------------------------------------------------------------
drop policy if exists "subscribers insert" on public.subscribers;
create policy "subscribers insert" on public.subscribers for insert with check (true);

drop policy if exists "subscribers admin select" on public.subscribers;
create policy "subscribers admin select" on public.subscribers for select
  using (public.is_admin());

drop policy if exists "subscribers admin delete" on public.subscribers;
create policy "subscribers admin delete" on public.subscribers for delete
  using (public.is_admin());

-- store settings -------------------------------------------------------------
drop policy if exists "store settings public read" on public.store_settings;
create policy "store settings public read" on public.store_settings for select
  using (true);

drop policy if exists "store settings admin manage" on public.store_settings;
create policy "store settings admin manage" on public.store_settings for all
  using (public.is_admin()) with check (public.is_admin());

grant select on public.store_settings to anon, authenticated;
grant insert, update on public.store_settings to authenticated;

-- ============================================================================
-- 4. STORAGE — public bucket for product images (admin upload)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "product-images public read" on storage.objects;
create policy "product-images public read" on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "product-images admin insert" on storage.objects;
create policy "product-images admin insert" on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product-images admin update" on storage.objects;
create policy "product-images admin update" on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product-images admin delete" on storage.objects;
create policy "product-images admin delete" on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());

-- ============================================================================
-- 5. SEED PRODUCTS (matches the storefront demo data)
-- ============================================================================

insert into public.products
  (slug, name, brand, category, tagline, description, price, compare_at_price,
   stock, rating, reviews_count, badge, badge_style, colors, storage_options,
   specs, highlights, tags, images, is_featured)
values
('iphone-16-pro-max', 'iPhone 16 Pro Max', 'Apple', 'flagship',
 'Titanium. So strong. So light. So Pro.',
 'Forged in Grade 5 titanium with the largest display ever on an iPhone — 6.9 inches of Super Retina XDR brilliance with ProMotion up to 120 Hz. Camera Control puts a pro camera in your pocket, and the A18 Pro chip delivers desktop-class performance with all-day battery life. Capture 4K 120 fps Dolby Vision video and zoom with the 5x tetraprism telephoto.',
 1199, 1299, 24, 4.8, 2431, 'New', 'new',
 '[{"name":"Desert Titanium","hex":"#c9b59a"},{"name":"Natural Titanium","hex":"#b7b4ab"},{"name":"White Titanium","hex":"#e8e6e1"},{"name":"Black Titanium","hex":"#3b3b3f"},{"name":"Blue Titanium","hex":"#2f4a6b"}]'::jsonb,
 '[{"label":"256 GB","delta":0},{"label":"512 GB","delta":200},{"label":"1 TB","delta":400}]'::jsonb,
 '[{"label":"Display","value":"6.9in Super Retina XDR OLED, 120 Hz"},{"label":"Chipset","value":"A18 Pro"},{"label":"RAM","value":"8 GB"},{"label":"Main camera","value":"48 MP Fusion"},{"label":"Telephoto","value":"12 MP, 5x"},{"label":"Battery","value":"~4,685 mAh, 33 h video"},{"label":"Charging","value":"USB-C, MagSafe 25 W"},{"label":"Weight","value":"227 g"},{"label":"Water resistance","value":"IP68"},{"label":"Updates","value":"5+ years"},{"label":"Stylus","value":"No"}]'::jsonb,
 '[{"icon":"cpu","title":"A18 Pro","text":"6-core GPU, 16-core Neural Engine"},{"icon":"camera","title":"48 MP Fusion","text":"+ 48 MP Ultra Wide, 12 MP 5x"},{"icon":"battery","title":"33 h video","text":"Best battery life ever on iPhone"},{"icon":"shield","title":"IP68","text":"Titanium frame, Ceramic Shield"}]'::jsonb,
 '{5g,wireless-charging}',
 '{https://images.pexels.com/photos/10883732/pexels-photo-10883732.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940,https://images.pexels.com/photos/30639091/pexels-photo-30639091.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940,https://images.pexels.com/photos/15916262/pexels-photo-15916262.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940,https://images.pexels.com/photos/13570158/pexels-photo-13570158.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940}',
 true),

('galaxy-s25-ultra', 'Galaxy S25 Ultra', 'Samsung', 'flagship',
 'The ultimate flagship with S Pen and 200 MP zoom.',
 'Galaxy S25 Ultra pairs a 6.9-inch anti-glare AMOLED 2X display with the Snapdragon 8 Elite, a 200 MP main camera and a dual telephoto system. The built-in S Pen and 7 years of updates make it the most flexible Android flagship you can buy.',
 1299, null, 18, 4.9, 1874, 'Hot', 'hot',
 '[{"name":"Titanium Silverblue","hex":"#b7c0cd"},{"name":"Titanium Black","hex":"#2e2e30"},{"name":"Titanium Gray","hex":"#54524e"}]'::jsonb,
 '[{"label":"256 GB","delta":0},{"label":"512 GB","delta":100},{"label":"1 TB","delta":300}]'::jsonb,
 '[{"label":"Display","value":"6.9in AMOLED 2X, 120 Hz, anti-glare"},{"label":"Chipset","value":"Snapdragon 8 Elite"},{"label":"RAM","value":"12 GB"},{"label":"Main camera","value":"200 MP"},{"label":"Telephoto","value":"50 MP 5x + 10 MP 3x"},{"label":"Battery","value":"5,000 mAh"},{"label":"Charging","value":"45 W wired"},{"label":"Weight","value":"218 g"},{"label":"Water resistance","value":"IP68"},{"label":"Updates","value":"7 years"},{"label":"Stylus","value":"S Pen included"}]'::jsonb,
 '[{"icon":"camera","title":"200 MP","text":"Quad telephoto zoom system"},{"icon":"cpu","title":"8 Elite","text":"Snapdragon, 12 GB RAM"},{"icon":"battery","title":"5,000 mAh","text":"45 W super-fast charging"},{"icon":"sparkle","title":"S Pen","text":"Built-in stylus + Galaxy AI"}]'::jsonb,
 '{5g,wireless-charging}',
 '{https://images.pexels.com/photos/30466739/pexels-photo-30466739.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940,https://images.pexels.com/photos/10885666/pexels-photo-10885666.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940,https://images.pexels.com/photos/13570158/pexels-photo-13570158.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940}',
 true),

('pixel-9-pro', 'Pixel 9 Pro', 'Google', 'flagship',
 'The brightest screen and the smartest AI in the trio.',
 'Pixel 9 Pro brings a 6.3-inch Super Actua display, Tensor G4 with 16 GB of RAM, and seven years of updates. Pro-grade computational photography with 48 MP 5x telephoto and Gemini AI built into everything.',
 999, 1099, 31, 4.7, 1120, '-9%', 'deal',
 '[{"name":"Porcelain","hex":"#e9e5df"},{"name":"Rose Quartz","hex":"#e6c9c4"},{"name":"Hazel","hex":"#5b5a52"}]'::jsonb,
 '[{"label":"128 GB","delta":0},{"label":"256 GB","delta":100},{"label":"512 GB","delta":220}]'::jsonb,
 '[{"label":"Display","value":"6.3in OLED, 120 Hz, 3,000 nits"},{"label":"Chipset","value":"Tensor G4"},{"label":"RAM","value":"16 GB"},{"label":"Main camera","value":"50 MP"},{"label":"Telephoto","value":"48 MP, 5x"},{"label":"Battery","value":"4,700 mAh"},{"label":"Charging","value":"27 W wired"},{"label":"Weight","value":"199 g"},{"label":"Water resistance","value":"IP68"},{"label":"Updates","value":"7 years"},{"label":"Stylus","value":"No"}]'::jsonb,
 '[{"icon":"sparkle","title":"Gemini AI","text":"Built into every app"},{"icon":"camera","title":"50 MP Pro","text":"48 MP 5x telephoto"},{"icon":"cpu","title":"Tensor G4","text":"16 GB RAM"},{"icon":"battery","title":"4,700 mAh","text":"30+ h with Adaptive Battery"}]'::jsonb,
 '{5g,wireless-charging}',
 '{https://images.pexels.com/photos/15916262/pexels-photo-15916262.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940,https://images.pexels.com/photos/10885666/pexels-photo-10885666.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940}',
 true),

('oneplus-13', 'OnePlus 13', 'OnePlus', 'flagship',
 'A 6,000 mAh battery that refuses to quit.',
 'OnePlus 13 packs the Snapdragon 8 Elite, a massive 6,000 mAh silicon-carbon battery and 100 W SUPERVOOC charging into a design that still feels light. Hasselblad-tuned cameras and a 2K 120 Hz display.',
 899, null, 27, 4.6, 864, '', '',
 '[{"name":"Midnight Ocean","hex":"#1c2733"},{"name":"Dawn Prism","hex":"#e8e3dd"}]'::jsonb,
 '[{"label":"256 GB","delta":0},{"label":"512 GB","delta":80}]'::jsonb,
 '[{"label":"Display","value":"6.8in LTPO OLED, 120 Hz"},{"label":"Chipset","value":"Snapdragon 8 Elite"},{"label":"RAM","value":"12 GB"},{"label":"Main camera","value":"50 MP Hasselblad"},{"label":"Battery","value":"6,000 mAh"},{"label":"Charging","value":"100 W wired, 50 W wireless"},{"label":"Weight","value":"210 g"},{"label":"Water resistance","value":"IP69"}]'::jsonb,
 '[]'::jsonb,
 '{5g,wireless-charging}',
 '{https://images.pexels.com/photos/12166786/pexels-photo-12166786.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940}',
 false),

('xiaomi-15-ultra', 'Xiaomi 15 Ultra', 'Xiaomi', 'flagship',
 'A 1-inch Leica sensor in your pocket.',
 'Co-engineered with Leica, the Xiaomi 15 Ultra features a 1-inch 50 MP main sensor, 200 MP periscope zoom and a 6.7-inch LTPO AMOLED. 90 W wired and 80 W wireless charging on a 6,000 mAh cell.',
 1099, null, 14, 4.7, 612, '', '',
 '[{"name":"Black","hex":"#26252a"},{"name":"White","hex":"#f2f1ec"}]'::jsonb,
 '[{"label":"512 GB","delta":0},{"label":"1 TB","delta":150}]'::jsonb,
 '[{"label":"Display","value":"6.7in LTPO AMOLED, 120 Hz"},{"label":"Chipset","value":"Snapdragon 8 Elite"},{"label":"RAM","value":"16 GB"},{"label":"Main camera","value":"Leica 1in 50 MP"},{"label":"Battery","value":"6,000 mAh"},{"label":"Charging","value":"90 W wired, 80 W wireless"},{"label":"Weight","value":"226 g"},{"label":"Water resistance","value":"IP68"}]'::jsonb,
 '[]'::jsonb,
 '{5g,wireless-charging}',
 '{https://images.pexels.com/photos/10885666/pexels-photo-10885666.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940}',
 false),

('nothing-phone-3', 'Phone (3)', 'Nothing', 'flagship',
 'Transparent design with the Glyph Interface.',
 'Nothing Phone (3) turns notifications into light with its upgraded Glyph Interface, wrapped in a transparent recycled-aluminium body. Snapdragon 8s Gen 3, 120 Hz AMOLED and a clean Nothing OS.',
 799, null, 22, 4.5, 398, 'New', 'new',
 '[{"name":"White","hex":"#f2f1ec"},{"name":"Black","hex":"#26252a"}]'::jsonb,
 '[{"label":"256 GB","delta":0},{"label":"512 GB","delta":100}]'::jsonb,
 '[{"label":"Display","value":"6.7in AMOLED, 120 Hz"},{"label":"Chipset","value":"Snapdragon 8s Gen 3"},{"label":"RAM","value":"12 GB"},{"label":"Main camera","value":"50 MP"},{"label":"Battery","value":"5,150 mAh"},{"label":"Charging","value":"65 W wired, 15 W wireless"},{"label":"Weight","value":"218 g"},{"label":"Water resistance","value":"IP68"}]'::jsonb,
 '[]'::jsonb,
 '{5g,wireless-charging}',
 '{https://images.pexels.com/photos/14979023/pexels-photo-14979023.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940}',
 false),

('galaxy-z-fold6', 'Galaxy Z Fold6', 'Samsung', 'foldable',
 'A 7.6-inch tablet that folds into a phone.',
 'The Galaxy Z Fold6 opens into a 7.6-inch canvas for multitasking and folds into a comfortable 6.3-inch phone. Snapdragon 8 Gen 3, 12 GB RAM, IP48 and full S Pen Pro support on the cover and inner displays.',
 1899, null, 9, 4.6, 540, 'Foldable', '',
 '[{"name":"Silver Shadow","hex":"#c6c8cc"},{"name":"Pink","hex":"#e6c9c4"},{"name":"Navy","hex":"#2f4a6b"}]'::jsonb,
 '[{"label":"256 GB","delta":0},{"label":"512 GB","delta":120},{"label":"1 TB","delta":320}]'::jsonb,
 '[{"label":"Display","value":"7.6in fold + 6.3in cover, 120 Hz"},{"label":"Chipset","value":"Snapdragon 8 Gen 3"},{"label":"RAM","value":"12 GB"},{"label":"Main camera","value":"50 MP"},{"label":"Battery","value":"4,400 mAh"},{"label":"Charging","value":"25 W wired"},{"label":"Weight","value":"239 g"},{"label":"Water resistance","value":"IP48"}]'::jsonb,
 '[]'::jsonb,
 '{5g,wireless-charging,foldable}',
 '{https://images.pexels.com/photos/30466740/pexels-photo-30466740.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940}',
 false),

('iphone-16', 'iPhone 16', 'Apple', 'flagship',
 'All the essentials, none of the compromise.',
 'iPhone 16 brings the A18 chip, Camera Control and the 48 MP Fusion camera to the 6.1-inch lineup, with latest-gen Ceramic Shield and USB-C. Available in five bold colours.',
 799, null, 46, 4.7, 3002, '', '',
 '[{"name":"Ultramarine","hex":"#2f4a6b"},{"name":"Pink","hex":"#f2c9d3"},{"name":"White","hex":"#f2f1ec"},{"name":"Black","hex":"#26252a"}]'::jsonb,
 '[{"label":"128 GB","delta":0},{"label":"256 GB","delta":100},{"label":"512 GB","delta":300}]'::jsonb,
 '[{"label":"Display","value":"6.1in OLED, 60 Hz"},{"label":"Chipset","value":"A18"},{"label":"RAM","value":"8 GB"},{"label":"Main camera","value":"48 MP Fusion"},{"label":"Battery","value":"3,561 mAh"},{"label":"Charging","value":"USB-C, MagSafe 25 W"},{"label":"Weight","value":"170 g"},{"label":"Water resistance","value":"IP68"}]'::jsonb,
 '[]'::jsonb,
 '{5g,wireless-charging}',
 '{https://images.pexels.com/photos/12969242/pexels-photo-12969242.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940}',
 false),

('galaxy-a56', 'Galaxy A56', 'Samsung', 'mid-range',
 'Flagship feel at a mid-range price.',
 'The Galaxy A56 brings a 6.7-inch 120 Hz AMOLED, a 50 MP OIS camera and 45 W charging to the mid-range — plus four generations of Android updates.',
 449, 499, 58, 4.4, 1311, 'Deal', 'deal',
 '[{"name":"Graphite","hex":"#54524e"},{"name":"Lime","hex":"#c9d6a5"}]'::jsonb,
 '[{"label":"128 GB","delta":0},{"label":"256 GB","delta":50}]'::jsonb,
 '[{"label":"Display","value":"6.7in AMOLED, 120 Hz"},{"label":"Chipset","value":"Exynos 1580"},{"label":"RAM","value":"8 GB"},{"label":"Main camera","value":"50 MP OIS"},{"label":"Battery","value":"5,000 mAh"},{"label":"Charging","value":"45 W wired"},{"label":"Weight","value":"198 g"},{"label":"Water resistance","value":"IP67"}]'::jsonb,
 '[]'::jsonb,
 '{5g}',
 '{https://images.pexels.com/photos/30466750/pexels-photo-30466750.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940}',
 false),

('pro-max-care-kit', 'Pro Max care kit', 'Prism Essentials', 'accessory',
 'Everything to protect your new phone.',
 'Clear MagSafe case, tempered screen glass and a 25 W USB-C charger — bundled at a third off.',
 79, 119, 120, 4.6, 210, 'Bundle', '',
 '[]'::jsonb, '[]'::jsonb,
 '[{"label":"Contents","value":"Clear MagSafe case, tempered glass, 25 W charger"},{"label":"Compatibility","value":"iPhone 16 Pro Max"}]'::jsonb,
 '[]'::jsonb,
 '{}',
 '{https://images.pexels.com/photos/8490071/pexels-photo-8490071.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940}',
 false)
on conflict (slug) do nothing;

-- ============================================================================
-- 6. MAKE YOURSELF ADMIN  (run AFTER signing up on the website's Login page)
-- ============================================================================
-- Sign up at login.html with your owner email, then run:
--
--   update public.profiles set role = 'admin' where email = 'you@example.com';
--
-- Then open admin.html — you are in.
-- ============================================================================
