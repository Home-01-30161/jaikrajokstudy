with open('client/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix hand size on Login page
content = content.replace(
    '<div className="fixed bottom-0 right-0 z-40 pointer-events-none" style={{ width: "220px" }}>',
    '<div className="fixed bottom-[-60px] right-[-20px] z-40 pointer-events-none" style={{ width: "450px" }}>'
)

# Also fix the hand size on OnbWelcome (it's currently w-64 which is 256px, let's make it bigger)
content = content.replace(
    'className="absolute bottom-[-40px] right-10 w-64 h-auto pointer-events-none z-20"',
    'className="absolute bottom-[-60px] right-0 w-96 h-auto pointer-events-none z-20"'
)

# And fix origamiStars on OnbWelcome
content = content.replace(
    'className="absolute bottom-10 left-10 w-72 h-auto pointer-events-none z-0"',
    'className="absolute bottom-10 left-10 w-96 h-auto pointer-events-none z-0"'
)

with open('client/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed hand size and placement!")
