#!/usr/bin/env python3
"""Split the Prism single-file :target demo into a real multi-page site."""
import re, pathlib, sys

SRC = pathlib.Path('/home/user/uploads/index.html')
OUT = pathlib.Path('/home/user/prism-site')
src = SRC.read_text(encoding='utf-8')

# ---------------- 1. CSS ----------------
css = re.search(r'<style>(.*?)</style>', src, re.S).group(1)

old_nav = '''body:not(:has(.page:target)) .nav a[href="#home"],
body:has(#home:target) .nav a[href="#home"],
body:has(#shop:target) .nav a[href="#shop"],
body:has(#product:target) .nav a[href="#product"],
body:has(#compare:target) .nav a[href="#compare"],
body:has(#about:target) .nav a[href="#about"],
body:has(#contact:target) .nav a[href="#contact"]{color:#fff;background:rgba(255,255,255,.12);box-shadow:inset 0 0 0 1px var(--stroke)}'''
new_nav = '''.nav a.active{color:#fff;background:rgba(255,255,255,.12);box-shadow:inset 0 0 0 1px var(--stroke)}'''
assert old_nav in css, 'nav active rule not found'
css = css.replace(old_nav, new_nav)

old_router = '''/* ---------- page router (CSS only) ---------- */
.page{display:none;padding-top:116px;animation:pageIn .6s cubic-bezier(.2,.7,.2,1) both;min-height:100vh}
.page:target{display:block}
#home{display:block}
.page:target ~ #home{display:none}'''
new_router = '''/* ---------- page shell (multi-page build) ---------- */
.page{padding-top:116px;animation:pageIn .6s cubic-bezier(.2,.7,.2,1) both;min-height:100vh}'''
assert old_router in css, 'page router rule not found'
css = css.replace(old_router, new_router)

css = css.replace('''   PRISM — pure HTML + CSS glassmorphism storefront
   No JavaScript: pages switch with :target, menus/tabs/galleries
   use :checked, the FAQ uses native <details>.''',
'''   PRISM — pure HTML + CSS glassmorphism storefront (multi-page)
   No JavaScript: menus/tabs/galleries use :checked, the FAQ uses
   native <details>. Shared by every page of the site.''')
assert ':target' not in css, 'leftover :target rule in CSS'

# ---------------- 2. shared chunks ----------------
sprite = re.search(r'<svg xmlns="http://www\.w3\.org/2000/svg" style="position:absolute.*?</svg>', src, re.S).group(0)
header = re.search(r'<header class="header glass">.*?</header>', src, re.S).group(0)
footer = re.search(r'<footer class="footer">.*?</footer>', src, re.S).group(0)

bg = '''<div class="bg" aria-hidden="true">
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>
  <div class="orb orb-3"></div>
  <div class="orb orb-4"></div>
</div>'''

sections = dict(re.findall(r'<section id="([a-z]+)" class="page">(.*?)</section>', src, re.S))
expected = {'shop','product','compare','cart','checkout','success','about','contact','home'}
assert set(sections) == expected, f'sections mismatch: {set(sections) ^ expected}'

# ---------------- 3. link rewriting ----------------
FILES = {'home':'index.html','shop':'shop.html','product':'product.html','compare':'compare.html',
         'cart':'cart.html','checkout':'checkout.html','success':'success.html',
         'about':'about.html','contact':'contact.html'}

def rewrite(html: str) -> str:
    for pid, f in FILES.items():
        html = html.replace(f'href="#{pid}"', f'href="{f}"')
    return html

header_r = rewrite(header)
footer_r = rewrite(footer)
sections_r = {pid: rewrite(inner) for pid, inner in sections.items()}

# ---------------- 4. per-page metadata & nav ----------------
META = {
 'home':    ('Prism — Phones in a new light',
             'Prism is a glass-clear way to buy your next phone. Flagships, foldables and budget picks — unlocked, insured and delivered in 48 hours.'),
 'shop':    ('Shop all phones — Prism',
             'Browse 128 unlocked phones from Apple, Samsung, Google, OnePlus, Xiaomi and Nothing. Filter by brand, price and storage — free 48h shipping on every order.'),
 'product': ('iPhone 16 Pro Max — Prism',
             'iPhone 16 Pro Max: 6.9-inch Super Retina XDR, A18 Pro chip and a 48 MP Fusion camera. Unlocked, from ৳1,199 with 2-year Prism Care included.'),
 'compare': ('Compare flagships — Prism',
             'Compare the iPhone 16 Pro Max, Galaxy S25 Ultra and Pixel 9 Pro XL spec by spec — display, cameras, battery, charging and price.'),
 'cart':    ('Your cart — Prism',
             'Review your cart, apply promo codes and check out with free 48h express delivery and 2-year Prism Care included.'),
 'checkout':('Checkout — Prism',
             'Secure Prism checkout: shipping, delivery options and payment. 256-bit encrypted, 30-day returns and 0% APR financing available.'),
 'success': ('Order confirmed — Prism',
             'Thank you for your order. Track your delivery, view your order details and contact Prism support any time.'),
 'about':   ('About Prism — Our story',
             'Prism started in 2019 to make buying a phone transparent. Meet the team, our values and six years of milestones.'),
 'contact': ('Contact us — Prism',
             'Talk to Prism: live chat, phone, email or visit the Austin showroom. Plus quick answers to the questions we hear most.'),
}
NAV = {'home':('index.html','Home'), 'shop':('shop.html','Shop'), 'product':('product.html','Featured'),
       'compare':('compare.html','Compare'), 'about':('about.html','About'), 'contact':('contact.html','Contact')}

TEMPLATE = '''<!DOCTYPE html>
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

<main>
{section}
</main>

<!-- ============ FOOTER ============ -->
{footer}

</body>
</html>
'''

OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'css').mkdir(exist_ok=True)
(OUT / 'css' / 'styles.css').write_text(css.strip() + '\n', encoding='utf-8')

for pid, (title, desc) in META.items():
    h = header_r
    if pid in NAV:
        f, label = NAV[pid]
        old = f'<a href="{f}">{label}</a>'
        new = f'<a href="{f}" class="active" aria-current="page">{label}</a>'
        assert old in h, f'nav link missing for {pid}'
        h = h.replace(old, new, 1)
    section = f'<section id="{pid}" class="page">{sections_r[pid]}</section>'
    html = TEMPLATE.format(title=title, desc=desc, sprite=sprite, bg=bg,
                           header=h, section=section, footer=footer_r)
    (OUT / FILES[pid]).write_text(html, encoding='utf-8')
    print(f'wrote {FILES[pid]:14s} ({len(html):,} bytes)')

print(f'wrote css/styles.css ({len(css):,} bytes)')
print('done —', len(META), 'pages')
