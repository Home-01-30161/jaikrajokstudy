import re

# Update index.html
with open('client/index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

new_font_url = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+Thai:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap"
html_content = re.sub(
    r'https://fonts\.googleapis\.com/css2\?family=([^"]+)',
    new_font_url,
    html_content
)

with open('client/index.html', 'w', encoding='utf-8') as f:
    f.write(html_content)


# Update App.tsx
with open('client/src/App.tsx', 'r', encoding='utf-8') as f:
    app_content = f.read()

# Replace all serif and miscellaneous fonts with the modern non-serif stack
fonts_to_replace = [
    r"'Playfair Display', Georgia, serif",
    r"'Playfair Display', serif",
    r"'Taviraj', serif",
    r"'IBM Plex Sans Thai', sans-serif",
    r"'Noto Sans Thai', sans-serif"
]

modern_stack = "'Inter', 'Noto Sans Thai', sans-serif"

for font in fonts_to_replace:
    app_content = app_content.replace(font, modern_stack)

with open('client/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(app_content)

print("Fonts updated to modern non-serif stack!")
