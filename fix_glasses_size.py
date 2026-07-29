with open('client/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Make glasses EVEN BIGGER on OnbAge
content = content.replace(
    'className="absolute top-20 right-20 w-80 h-auto pointer-events-none z-0 opacity-80"',
    'className="absolute top-[-50px] right-[-100px] w-[1200px] h-auto pointer-events-none z-0 opacity-80"'
)

# Just in case there are other glasses references that were missed
content = content.replace(
    'className="absolute top-20 right-20 w-32 h-auto pointer-events-none z-0 opacity-80"',
    'className="absolute top-[-50px] right-[-100px] w-[1200px] h-auto pointer-events-none z-0 opacity-80"'
)

with open('client/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Glasses are now MASSIVE!")
