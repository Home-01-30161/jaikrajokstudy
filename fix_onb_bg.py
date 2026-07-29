import re

with open("client/src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add grid to IMG object if not there
if "grid: " not in content:
    content = content.replace(
        'loginCollage: "/collage/login_collage_ffaf73f0.png",',
        'loginCollage: "/collage/login_collage_ffaf73f0.png",\n    grid: "/collage/grid.png",'
    )

def replace_comp(name, new_background_jsx):
    global content
    # Find the function definition to the start of the card div
    pattern = r'(function ' + name + r'\([^)]*\) \{[\s\S]*?return \([\s\S]*?<div className="min-h-screen[^>]+>)([\s\S]*?)(<div className="relative mx-auto z-10")'
    
    match = re.search(pattern, content)
    if not match:
        print(f"Could not find {name}")
        return
    
    # We replace everything between the <div min-h-screen...> and <div relative mx-auto z-10>
    content = re.sub(pattern, r'\g<1>' + new_background_jsx + r'\g<3>', content)

welcome_bg = """
        <img src={IMG.grid} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 opacity-60" alt="" />
        <img src={IMG.origamiStarsNoBg} className="absolute bottom-10 left-10 w-72 h-auto pointer-events-none z-0" alt="" />
        <img src={IMG.hand} className="absolute bottom-[-40px] right-10 w-64 h-auto pointer-events-none z-20" alt="" />
        <img src={IMG.redstar} className="absolute top-16 right-24 w-16 h-auto pointer-events-none z-0" alt="" />
        """

age_bg = """
        <img src={IMG.grid} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 opacity-60" alt="" />
        <img src={IMG.booksStackNoBg} className="absolute bottom-0 left-0 w-80 h-auto pointer-events-none z-0" alt="" />
        <img src={IMG.glasses} className="absolute top-20 right-20 w-32 h-auto pointer-events-none z-0 opacity-80" alt="" />
        """

guardian_bg = """
        <img src={IMG.grid} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 opacity-60" alt="" />
        <img src={IMG.shieldLockNoBg} className="absolute top-10 right-10 w-64 h-auto pointer-events-none z-0" alt="" />
        <img src={IMG.bulb} className="absolute bottom-16 left-16 w-32 h-auto pointer-events-none z-0 opacity-90" alt="" />
        """

privacy_bg = """
        <img src={IMG.grid} className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0 opacity-60" alt="" />
        <img src={IMG.chartGraphNoBg} className="absolute bottom-10 left-10 w-72 h-auto pointer-events-none z-0" alt="" />
        <img src={IMG.dots} className="absolute top-16 right-16 w-32 h-auto pointer-events-none z-0 opacity-70" alt="" />
        """

replace_comp("OnbWelcome", welcome_bg)
replace_comp("OnbAge", age_bg)
replace_comp("GuardianPage", guardian_bg)
replace_comp("PrivacyPage", privacy_bg)

with open("client/src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed onboarding pages backgrounds!")
