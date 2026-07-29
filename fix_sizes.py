with open('client/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Make hand drastically bigger on LoginPage
# Currently it is: <div className="fixed bottom-[-60px] right-[-20px] z-40 pointer-events-none" style={{ width: "450px" }}>
content = content.replace(
    '<div className="fixed bottom-[-60px] right-[-20px] z-40 pointer-events-none" style={{ width: "450px" }}>',
    '<div className="fixed bottom-[-150px] right-[-150px] z-40 pointer-events-none" style={{ width: "1200px" }}>'
)

# Make glasses bigger on OnbAge
# Currently: <img src={IMG.glasses} className="absolute top-20 right-20 w-32 h-auto pointer-events-none z-0 opacity-80" alt="" />
content = content.replace(
    'className="absolute top-20 right-20 w-32 h-auto pointer-events-none z-0 opacity-80"',
    'className="absolute top-20 right-20 w-80 h-auto pointer-events-none z-0 opacity-80"'
)

# Make hand drastically bigger on OnbWelcome (it's currently w-96 which is 384px)
content = content.replace(
    'className="absolute bottom-[-60px] right-0 w-96 h-auto pointer-events-none z-20"',
    'className="absolute bottom-[-100px] right-[-100px] w-[800px] h-auto pointer-events-none z-20"'
)

# Also fix the hand on OnbAge, GuardianPage, PrivacyPage if they have it
# OnbAge hand:
content = content.replace(
    'className="absolute bottom-10 right-10 w-64 h-auto pointer-events-none z-20"',
    'className="absolute bottom-[-100px] right-[-100px] w-[800px] h-auto pointer-events-none z-20"'
)
# GuardianPage hand:
content = content.replace(
    'className="absolute bottom-[-20px] right-10 w-72 h-auto pointer-events-none z-20"',
    'className="absolute bottom-[-100px] right-[-100px] w-[800px] h-auto pointer-events-none z-20"'
)
# PrivacyPage hand:
content = content.replace(
    'className="absolute bottom-[-20px] right-[-20px] w-64 h-auto pointer-events-none z-20"',
    'className="absolute bottom-[-100px] right-[-100px] w-[800px] h-auto pointer-events-none z-20"'
)

with open('client/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Hands and glasses are now massive!")
