import re
with open('client/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Use regex to replace the glasses image className regardless of exact spacing/opacity
content = re.sub(
    r'<img src=\{IMG\.glasses\} className=\"absolute top-20 right-20 w-32 [^\"]+\" alt=\"\" />',
    r'<img src={IMG.glasses} className="absolute top-[-300px] right-[-300px] w-[1800px] h-auto pointer-events-none z-0" alt="" />',
    content
)

with open('client/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done regex replacement!')
