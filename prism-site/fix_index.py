import pathlib

p = pathlib.Path('index.html')
html = p.read_text(encoding='utf-8')

head, _, body = html.partition('<body>')
body = body.rpartition('</body>')[0]

replacements = [
    ('href="#checkout"', 'href="checkout.html"'),
    ('href="#cart"', 'href="cart.html"'),
    ('href="#shop"', 'href="shop.html"'),
    ('href="#product"', 'href="product.html"'),
    ('href="#compare"', 'href="compare.html"'),
    ('href="#about"', 'href="about.html"'),
    ('href="#contact"', 'href="contact.html"'),
    ('href="#home"', 'href="index.html"'),
]

for old, new in replacements:
    body = body.replace(old, new)

p.write_text(head + '<body>' + body + '</body>', encoding='utf-8')
print('Fixed index.html')