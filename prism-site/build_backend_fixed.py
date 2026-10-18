#!/usr/bin/env python3
"""Wire the Prism multi-page site to the Supabase backend:
- header/footer/script surgery on all 9 storefront pages
- replace static mains with dynamic containers (shop/product/compare/cart/checkout/success)
- small hooks on index + contact
- generate login.html, account.html, admin.html
"""
import re, pathlib

SITE = pathlib.Path('/.')

STORE_SCRIPTS = '''<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/config.js"></script>
<script src="js/db.js"></script>
<script src="js/ui.js"></script>
<script src="js/app.js"></script>
'''

ADMIN_SCRIPTS = '''<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/config.js"></script>
<script src="js/db.js"></script>
<script src="js/ui.js"></script>
<script src="js/admin.js"></script>
'''

# ---------------------------------------------------------------- header surgery (all pages)
OLD_SEARCH = '''    <label class="search-pill"><svg class="ic sm"><use href="#i-search"/></svg><input type="search" placeholder="Search phones…" aria-label="Search phones"></label>'''
NEW_SEARCH = '''    <form class="search-pill" action="shop.html" method="get" role="search"><svg class="ic sm"><use href="#i-search"/></svg><input type="search" name="q" placeholder="Search phones…" aria-label="Search phones"></form>'''

OLD_CART = '''<a href="cart.html" class="icon-btn" aria-label="Cart, 3 items"><svg class="ic"><use href="#i-cart"/></svg><span class="dot">3</span></a>'''
NEW_CART = '''<a href="cart.html" class="icon-btn" aria-label="Cart"><svg class="ic"><use href="#i-cart"/></svg><span class="dot" id="cart-count" hidden>0</span></a>'''

OLD_ACCT = '''    <a href="checkout.html" class="icon-btn hide-sm" aria-label="Account"><svg class="ic"><use href="#i-user"/></svg></a>'''
NEW_ACCT = '''    <a href="login.html" class="icon-btn hide-sm" id="account-btn" aria-label="Account" title="Sign in"><svg class="ic"><use href="#i-user"/></svg></a>'''

OLD_FOOTER_SUPPORT = '''<li><a href="contact.html">Contact us</a></li>'''
NEW_FOOTER_SUPPORT = '''<li><a href="contact.html">Contact us</a></li><li><a href="admin.html">Admin panel</a></li>'''

def header_surgery(html: str) -> str:
    for old, new in [(OLD_SEARCH, NEW_SEARCH), (OLD_CART, NEW_CART), (OLD_ACCT, NEW_ACCT),
                     (OLD_FOOTER_SUPPORT, NEW_FOOTER_SUPPORT)]:
        assert old in html, f'missing snippet: {old[:60]}…'
        html = html.replace(old, new, 1)
    assert '</body>' in html
    return html.replace('</body>', STORE_SCRIPTS + '</body>', 1)

# ---------------------------------------------------------------- new mains
SHOP_MAIN = '''<main>
<section id="shop" class="page">
  <div class="wrap">
    <div class="page-head">
      <div class="crumbs"><a href="index.html">Home</a><svg class="ic"><use href="#i-chev"/></svg><span>Shop</span></div>
      <h1>All phones</h1>
      <p>Every unlocked device we stock — each one covered by free 48h shipping and 2-year Prism Care.</p>
    </div>

    <div class="shop">
      <aside class="filters glass">
        <div class="filters-head"><h3><svg class="ic"><use href="#i-sliders"/></svg> Filters</h3><button type="button" id="filters-reset">Reset</button></div>
        <div class="fgroup"><h4>Brand</h4><div id="filter-brands"></div></div>
        <div class="fgroup"><h4>Category</h4><div id="filter-cats"></div></div>
        <div class="fgroup">
          <h4>Price</h4>
          <div class="range"><input type="range" id="filter-price" min="0" max="2000" step="50" value="2000" aria-label="Maximum price"><div><span>৳0</span><b id="filter-price-out">any price</b><span id="filter-price-max">৳2,000</span></div></div>
        </div>
        <div class="fgroup"><h4>Storage</h4><div id="filter-storage"></div></div>
        <div class="fgroup">
          <h4>Features</h4>
          <label class="switch-row">5G ready <input type="checkbox" class="switch" data-tag="5g"></label>
          <label class="switch-row">Foldable <input type="checkbox" class="switch" data-tag="foldable"></label>
          <label class="switch-row">Wireless charging <input type="checkbox" class="switch" data-tag="wireless-charging"></label>
          <label class="switch-row">In stock only <input type="checkbox" class="switch" id="filter-stock"></label>
        </div>
      </aside>

      <div>
        <div class="toolbar glass">
          <p id="results-count">Loading phones…</p>
          <div class="sort"><label for="sort">Sort by</label><select id="sort">
            <option value="recommended">Recommended</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="newest">Newest</option>
            <option value="rating">Top rated</option>
          </select></div>
        </div>
        <div class="chips" id="filter-chips"></div>
        <div class="grid" id="shop-grid"></div>
        <div class="pager" id="shop-pager"></div>
      </div>
    </div>
  </div>
</section>
</main>'''

PRODUCT_MAIN = '''<main>
<section id="product" class="page">
  <div class="wrap">
    <div class="crumbs" id="pd-crumbs" style="margin-bottom:22px"></div>
    <div class="pd">
      <div class="gallery glass" id="pd-gallery"></div>
      <div class="pinfo glass" id="pd-info"></div>
    </div>
    <div class="tabs glass" id="pd-tabs"></div>
    <div class="section">
      <div class="sec-head"><div><span class="eyebrow">You may also like</span><h2>Compared most often with</h2></div><a href="compare.html" class="link">Open compare <svg class="ic sm"><use href="#i-arrow"/></svg></a></div>
      <div class="grid" id="pd-related"></div>
    </div>
  </div>
</section>
</main>'''

COMPARE_MAIN = '''<main>
<section id="compare" class="page">
  <div class="wrap">
    <div class="page-head">
      <div class="crumbs"><a href="index.html">Home</a><svg class="ic"><use href="#i-chev"/></svg><span>Compare</span></div>
      <h1>Compare flagships side by side</h1>
      <p>The most-asked-about phones of the year, spec for spec — pulled live from the catalogue.</p>
    </div>
    <div class="cmp-pick" id="cmp-pick"></div>
    <div class="cmp glass" id="cmp-table"></div>
    <div class="section"><div class="feats" id="cmp-verdicts"></div></div>
  </div>
</section>
</main>'''

CART_MAIN = '''<main>
<section id="cart" class="page">
  <div class="wrap">
    <div class="page-head">
      <div class="crumbs"><a href="index.html">Home</a><svg class="ic"><use href="#i-chev"/></svg><span>Cart</span></div>
      <h1>Your cart <span class="muted" id="cart-count-label" style="font-weight:400;font-size:.6em"></span></h1>
    </div>
    <div id="cart-root"></div>
  </div>
</section>
</main>'''

CHECKOUT_MAIN = '''<main>
<section id="checkout" class="page">
  <div class="wrap">
    <div class="page-head">
      <div class="crumbs"><a href="index.html">Home</a><svg class="ic"><use href="#i-chev"/></svg><a href="cart.html">Cart</a><svg class="ic"><use href="#i-chev"/></svg><span>Checkout</span></div>
      <h1>Checkout</h1>
      <p>Secure checkout — your details are encrypted end to end.</p>
      <div class="cart-note glass mt-1" id="checkout-user" hidden style="display:inline-flex"></div>
    </div>
    <div class="checkout">
      <div>
        <div class="form-card glass">
          <h3><span class="step">1</span> Contact &amp; shipping</h3>
          <div class="fgrid">
            <div class="field"><label for="fn">First name</label><input id="fn" type="text" placeholder="Amara" autocomplete="given-name"></div>
            <div class="field"><label for="ln">Last name</label><input id="ln" type="text" placeholder="Mitchell" autocomplete="family-name"></div>
            <div class="field"><label for="em">Email</label><input id="em" type="email" placeholder="you@example.com" autocomplete="email"></div>
            <div class="field"><label for="ph">Phone</label><input id="ph" type="tel" placeholder="+1 (555) 000-0000" autocomplete="tel"></div>
            <div class="field full"><label for="ad">Street address</label><input id="ad" type="text" placeholder="123 Crystal Avenue, Apt 4B" autocomplete="street-address"></div>
            <div class="field"><label for="ci">City</label><input id="ci" type="text" placeholder="Austin" autocomplete="address-level2"></div>
            <div class="field"><label for="zp">Postcode</label><input id="zp" type="text" placeholder="78701" autocomplete="postal-code"></div>
            <div class="field full"><label for="co">Country</label><select id="co" autocomplete="country-name"><option>United States</option><option>United Kingdom</option><option>Germany</option><option>Canada</option><option>Australia</option></select></div>
          </div>
        </div>

        <div class="form-card glass">
          <h3><span class="step">2</span> Delivery</h3>
          <div class="radio-cards">
            <input type="radio" name="del" id="d1" data-ship="0" data-method="standard"><label for="d1"><b>Standard <em>Free</em></b><span>3–5 business days</span></label>
            <input type="radio" name="del" id="d2" checked data-ship="0" data-method="express"><label for="d2"><b>Express <em>Free</em></b><span>48 hours · tracked</span></label>
            <input type="radio" name="del" id="d3" data-ship="25" data-method="sameday"><label for="d3"><b>Same day <em>৳25</em></b><span>Order by 2 pm · select cities</span></label>
          </div>
        </div>

        <div class="form-card glass">
          <h3><span class="step">3</span> Payment</h3>
          <div class="radio-cards" style="margin-bottom:24px">
            <input type="radio" name="pay" id="pm1" checked data-method="card"><label for="pm1"><b>Card</b><span>Visa, Mastercard, Amex</span></label>
            <input type="radio" name="pay" id="pm2" data-method="wallet"><label for="pm2"><b>Wallet</b><span>Apple Pay · Google Pay</span></label>
            <input type="radio" name="pay" id="pm3" data-method="pay-in-3"><label for="pm3"><b>Pay in 3</b><span>0% interest, no fees</span></label>
          </div>
          <div class="pay-grid">
            <div class="fgrid">
              <div class="field full"><label for="cn">Card number</label><input id="cn" type="text" placeholder="4242 4242 4242 4242" inputmode="numeric" autocomplete="cc-number"></div>
              <div class="field full"><label for="ch">Name on card</label><input id="ch" type="text" placeholder="AMARA MITCHELL" autocomplete="cc-name"></div>
              <div class="field"><label for="ex">Expiry</label><input id="ex" type="text" placeholder="MM / YY" autocomplete="cc-exp"></div>
              <div class="field"><label for="cv">CVC</label><input id="cv" type="text" placeholder="•••" inputmode="numeric" autocomplete="cc-csc"></div>
            </div>
            <div class="ccard" aria-hidden="true">
              <div class="cc-top"><span class="chip"></span><span class="cc-logo">prism pay</span></div>
              <div>
                <div class="cc-num" id="cc-num">4242 •••• •••• 4242</div>
                <div class="cc-row" style="margin-top:14px"><div><small>Card holder</small><span id="cc-name">YOUR NAME</span></div><div><small>Expires</small><span id="cc-exp">MM / YY</span></div></div>
              </div>
            </div>
          </div>
          <label class="check mt-2"><input type="checkbox" checked><span>Billing address is the same as shipping</span></label>
        </div>
      </div>

      <aside class="summary glass" id="checkout-summary"></aside>
    </div>
  </div>
</section>
</main>'''

SUCCESS_MAIN = '''<main>
<section id="success" class="page">
  <div class="wrap">
    <div class="success glass">
      <div class="okmark"><svg class="ic"><use href="#i-check"/></svg></div>
      <span class="eyebrow">Order confirmed</span>
      <h1 class="mt-1" id="success-title">Thank you!</h1>
      <p>Your phones are being prepared in our crystal-clear warehouse. We've emailed your receipt and a live tracking link.</p>
      <span class="code" id="success-number">ORDER #PR-00000</span>
      <div class="steps" id="success-steps"></div>
      <div class="hero-cta" style="justify-content:center;margin-top:10px">
        <a href="shop.html" class="btn btn-primary">Keep shopping</a>
        <a href="contact.html" class="btn btn-glass">Need help?</a>
      </div>
    </div>
  </div>
</section>
</main>'''

MAINS = {'shop': SHOP_MAIN, 'product': PRODUCT_MAIN, 'compare': COMPARE_MAIN,
         'cart': CART_MAIN, 'checkout': CHECKOUT_MAIN, 'success': SUCCESS_MAIN}

LOGIN_MAIN = '''<main>
<section id="login" class="page">
  <div class="wrap">
    <div class="auth-wrap">
      <div class="form-card glass auth-card">
        <span class="eyebrow">Prism account</span>
        <h1 style="font-size:1.9rem;margin:14px 0 6px">Welcome back</h1>
        <p class="muted" style="margin-bottom:24px">Track orders, save your details and check out faster.</p>
        <div class="auth-tabs" id="auth-tabs">
          <button type="button" class="on" data-tab="signin">Sign in</button>
          <button type="button" data-tab="signup">Create account</button>
        </div>
        <form id="auth-form" novalidate>
          <div class="field" id="au-name-field"><label for="au-name">Full name</label><input id="au-name" type="text" placeholder="Amara Mitchell" autocomplete="name"></div>
          <div class="field"><label for="au-email">Email</label><input id="au-email" type="email" placeholder="you@example.com" autocomplete="email" required></div>
          <div class="field"><label for="au-pass">Password</label><input id="au-pass" type="password" placeholder="Minimum 6 characters" minlength="6" autocomplete="current-password" required></div>
          <p class="auth-error" id="auth-error" hidden></p>
          <button class="btn btn-primary btn-block btn-lg mt-2" type="submit" id="auth-submit">Sign in</button>
        </form>
        <p class="auth-note" id="auth-demo-note" hidden>Demo mode — any email &amp; password works. Try <b>owner@prism.demo</b> to open the admin panel.</p>
        <p class="auth-note">Owner? After promoting your account (README-SETUP.md, step 6) head to <a class="link" href="admin.html" style="font-size:inherit">the admin panel</a>.</p>
      </div>
    </div>
  </div>
</section>
</main>'''

ACCOUNT_MAIN = '''<main>
<section id="account" class="page">
  <div class="wrap">
    <div class="page-head">
      <div class="crumbs"><a href="index.html">Home</a><svg class="ic"><use href="#i-chev"/></svg><span>Account</span></div>
      <h1>My account</h1>
      <p>Your profile, order history and tracking codes.</p>
    </div>
    <div class="account-grid" id="account-root"></div>
  </div>
</section>
</main>'''

# ---------------------------------------------------------------- index + contact tweaks
def index_tweaks(html: str) -> str:
    # category cards deep-link into shop filters
    for color, cat in [('#8b5cf6', 'flagship'), ('#f472b6', 'foldable'), ('#22d3ee', 'mid-range'), ('#fbbf24', 'budget')]:
        old = f'href="shop.html" class="cat glass" style="--c:{color}"'
        assert old in html, f'missing cat {cat}'
        html = html.replace(old, f'href="shop.html?cat={cat}" class="cat glass" style="--c:{color}"', 1)
    # featured grid becomes dynamic
    pat = re.compile(r'<div class="grid">\s*(?:<article class="card glass">.*?</article>\s*){4}</div>(\s*</div>\s*<!-- Why Prism -->)', re.S)
    m = pat.search(html)
    assert m, 'featured grid not found'
    html = pat.sub(lambda _: '<div class="grid" id="featured-grid">'
                   + '<div class="card glass sk-card"><div class="sk" style="aspect-ratio:1;border-radius:18px"></div><div class="sk" style="height:14px;margin:14px 6px 0"></div><div class="sk" style="height:18px;width:60%;margin:10px 6px"></div><div class="sk" style="height:14px;width:40%;margin:0 6px 18px"></div></div>' * 4
                   + '</div>' + _.group(1), html, count=1)
    # newsletter form
    old_news = '''<div class="input-pill"><svg class="ic sm"><use href="#i-mail"/></svg><input type="email" placeholder="you@example.com" aria-label="Email address"><button type="button" class="btn btn-primary btn-sm">Subscribe</button></div>'''
    new_news = '''<form class="input-pill" id="newsletter-form"><svg class="ic sm"><use href="#i-mail"/></svg><input type="email" id="newsletter-email" placeholder="you@example.com" aria-label="Email address" required><button type="submit" class="btn btn-primary btn-sm">Subscribe</button></form>'''
    assert old_news in html, 'newsletter not found'
    return html.replace(old_news, new_news, 1)

def contact_tweaks(html: str) -> str:
    old = '''<div class="form-card glass" style="margin:0">'''
    assert old in html
    html = html.replace(old, '''<form class="form-card glass" id="contact-form" style="margin:0">''', 1)
    old_btn = '''<button type="button" class="btn btn-primary btn-lg mt-2">Send message <svg class="ic"><use href="#i-send"/></svg></button>
      </div>'''
    new_btn = '''<button type="submit" id="contact-send" class="btn btn-primary btn-lg mt-2">Send message <svg class="ic"><use href="#i-send"/></svg></button>
      </form>'''
    assert old_btn in html, 'contact button not found'
    return html.replace(old_btn, new_btn, 1)

# ---------------------------------------------------------------- process the 9 pages
for pid in ['index', 'shop', 'product', 'compare', 'cart', 'checkout', 'success', 'about', 'contact']:
    f = SITE / (pid + '.html')
    html = f.read_text(encoding='utf-8')
    html = header_surgery(html)
    if pid in MAINS:
        html = re.sub(r'<main>.*?</main>', lambda _: MAINS[pid], html, count=1, flags=re.S)
    if pid == 'index':
        html = index_tweaks(html)
    if pid == 'contact':
        html = contact_tweaks(html)
    f.write_text(html, encoding='utf-8')
    print(f'updated {pid}.html')

# ---------------------------------------------------------------- shared parts from index
idx = (SITE / 'index.html').read_text(encoding='utf-8')
sprite = re.search(r'<svg xmlns="http://www\.w3\.org/2000/svg" style="position:absolute.*?</svg>', idx, re.S).group(0)
header = re.search(r'<header class="header glass">.*?</header>', idx, re.S).group(0).replace(' class="active" aria-current="page"', '')
footer = re.search(r'<footer class="footer">.*?</footer>', idx, re.S).group(0)
bg = '''<div class="bg" aria-hidden="true">
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>
  <div class="orb orb-3"></div>
  <div class="orb orb-4"></div>
</div>'''

PAGE = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/styles.css">
</head>
<body>

<!-- ============ SVG ICON SPRITE ============ -->
{sprite}

<!-- ============ AMBIENT BACKGROUND ============ -->
{bg}

<!-- ============ HEADER ============ -->
{header}

{main}

<!-- ============ FOOTER ============ -->
{footer}

{scripts}</body>
</html>
'''

(SITE / 'login.html').write_text(PAGE.format(
    title='Sign in — Prism', desc='Sign in to your Prism account to track orders, save your details and check out faster.',
    sprite=sprite, bg=bg, header=header, main=LOGIN_MAIN, footer=footer, scripts=STORE_SCRIPTS), encoding='utf-8')
print('created login.html')

(SITE / 'account.html').write_text(PAGE.format(
    title='My account — Prism', desc='Your Prism profile, order history and tracking codes.',
    sprite=sprite, bg=bg, header=header, main=ACCOUNT_MAIN, footer=footer, scripts=STORE_SCRIPTS), encoding='utf-8')
print('created account.html')

ADMIN = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Prism Admin — Dashboard</title>
<meta name="description" content="Prism owner dashboard: track and process orders, manage products and images, see users and messages.">
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/styles.css">
</head>
<body class="admin-body">

<!-- ============ SVG ICON SPRITE ============ -->
{sprite}

<!-- ============ AMBIENT BACKGROUND ============ -->
{bg}

<div id="admin-guard" hidden></div>

<div class="admin-shell">
  <aside class="admin-side glass">
    <a href="index.html" class="logo" style="margin-bottom:16px"><span class="logo-mark"></span><span>Prism</span></a>
    <nav class="admin-nav" aria-label="Admin">
      <a href="#/dashboard"><svg class="ic"><use href="#i-cpu"/></svg> Dashboard</a>
      <a href="#/orders"><svg class="ic"><use href="#i-cart"/></svg> Orders</a>
      <a href="#/products"><svg class="ic"><use href="#i-phone"/></svg> Products</a>
      <a href="#/users"><svg class="ic"><use href="#i-user"/></svg> Users</a>
      <a href="#/messages"><svg class="ic"><use href="#i-mail"/></svg> Messages</a>
    </nav>
    <div style="margin-top:auto;display:grid;gap:10px">
      <a href="index.html" class="btn btn-glass btn-sm btn-block"><svg class="ic sm"><use href="#i-globe"/></svg> View store</a>
      <div class="admin-user" id="admin-user"></div>
      <button class="btn btn-glass btn-sm btn-block" id="admin-signout" type="button"><svg class="ic sm"><use href="#i-x"/></svg> Sign out</button>
    </div>
  </aside>

  <div class="admin-main">
    <header class="admin-top glass">
      <h1 id="admin-title">Dashboard</h1>
      <span id="mode-badge"></span>
      <button class="icon-btn" id="admin-refresh" style="margin-left:auto" aria-label="Refresh" type="button"><svg class="ic"><use href="#i-refresh"/></svg></button>
    </header>
    <div id="admin-view"></div>
  </div>
</div>

{scripts}</body>
</html>
'''
(SITE / 'admin.html').write_text(ADMIN.format(sprite=sprite, bg=bg, scripts=ADMIN_SCRIPTS), encoding='utf-8')
print('created admin.html')
print('done')
