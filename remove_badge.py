with open('client/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '        <div className="w-10 h-3.5 rounded-full mb-6" style={{ border: \'1px solid #2D6A6F\' }} />\n',
    ''
)

with open('client/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Removed the pill badges!')
