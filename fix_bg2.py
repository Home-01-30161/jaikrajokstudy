with open("client/src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

def replace_block(name, new_bg):
    global content
    # Find function
    func_idx = content.find(f"function {name}")
    if func_idx == -1: return
    
    # Find return (
    ret_idx = content.find("return (", func_idx)
    
    # Find <div className="min-h-screen
    min_h_idx = content.find('<div className="min-h-screen', ret_idx)
    
    # Find the end of this div tag
    end_div_idx = content.find('>', min_h_idx) + 1
    
    # Find <div className="relative mx-auto
    rel_mx_idx = content.find('<div className="relative mx-auto', end_div_idx)
    
    # Extract the block to replace
    old_bg = content[end_div_idx:rel_mx_idx]
    
    # Replace
    content = content[:end_div_idx] + new_bg + content[rel_mx_idx:]

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

replace_block("OnbWelcome", welcome_bg)
replace_block("OnbAge", age_bg)
replace_block("GuardianPage", guardian_bg)
replace_block("PrivacyPage", privacy_bg)

with open("client/src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed without regex!")
