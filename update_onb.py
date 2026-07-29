import re

with open("client/src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Update IMG object
new_img_str = """const IMG = {
    loginCollage: "/collage/login_collage_ffaf73f0.png",
    handPen: "/collage/hand_pen_b35a681f.png",
    origamiStars: "/collage/origami_stars_0584c42e.png",
    megaphone: "/collage/megaphone_halftone_f526c4ce.png",
    booksStack: "/collage/books_stack_435c2b81.png",
    chatBubbles: "/collage/chat_bubbles_77801543.png",
    chartGraph: "/collage/chart_graph_a92a34b6.png",
    schoolBuilding: "/collage/school_building_8cd04dbb.png",
    shieldLock: "/collage/shield_lock_6bc87c75.png",
    hand: "/collage/hand.png",
    booksStackNoBg: "/collage/books_stack_435c2b81-removebg-preview.png",
    chartGraphNoBg: "/collage/chart_graph_a92a34b6-removebg-preview.png",
    chatBubblesNoBg: "/collage/chat_bubbles_77801543-removebg-preview.png",
    origamiStarsNoBg: "/collage/origami_stars_0584c42e-removebg-preview.png",
    schoolBuildingNoBg: "/collage/school_building_8cd04dbb-removebg-preview.png",
    shieldLockNoBg: "/collage/shield_lock_6bc87c75-removebg-preview.png",
    amplifier: "/collage/amplifier.png",
    bulb: "/collage/bulb.png",
    dots: "/collage/dots.png",
    glasses: "/collage/glasses.png",
    redstar: "/collage/redstar.png",
    star: "/collage/star.png",
};"""

content = re.sub(r'const IMG = \{[^}]+\};', new_img_str, content, count=1)

# Now, we rewrite the 4 onboarding components to add grid lines and the no-bg images
# Note: Since I don't know the exact current string for each due to the previous replacements, I'll extract them using regex.

def replace_component(comp_name, images_html):
    global content
    
    # Grid HTML to insert right after <div className="min-h-screen ...">
    grid_html = '\\n      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none" style={{ background: `linear-gradient(${T.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${T.gridLine} 1px, transparent 1px)`, backgroundSize: "28px 28px" }} />\\n'
    
    # Regex to find the component
    pattern = r'(function ' + comp_name + r'\([^)]*\) \{[\s\S]*?<div className="min-h-screen flex items-center justify-center relative overflow-hidden" style=\{\{ backgroundColor: "#F5EFE6" \}\}>)[\s\S]*?(<div className="relative mx-auto z-10")'
    
    def repl(m):
        return m.group(1) + grid_html + images_html + m.group(2)
        
    content = re.sub(pattern, repl, content)

replace_component("OnbWelcome", '\\n      <img src={IMG.origamiStarsNoBg} className="absolute bottom-10 left-10 w-72 h-auto pointer-events-none z-0" alt="" />\\n      <img src={IMG.hand} className="absolute bottom-[-20px] right-10 w-56 h-auto pointer-events-none z-20" alt="" />\\n      <img src={IMG.redstar} className="absolute top-16 right-24 w-16 h-auto pointer-events-none z-0" alt="" />\\n      ')

replace_component("OnbAge", '\\n      <img src={IMG.booksStackNoBg} className="absolute bottom-0 left-0 w-80 h-auto pointer-events-none z-0" alt="" />\\n      <img src={IMG.glasses} className="absolute top-20 right-20 w-32 h-auto pointer-events-none z-0 opacity-80" alt="" />\\n      ')

replace_component("GuardianPage", '\\n      <img src={IMG.shieldLockNoBg} className="absolute top-10 right-10 w-64 h-auto pointer-events-none z-0" alt="" />\\n      <img src={IMG.bulb} className="absolute bottom-16 left-16 w-32 h-auto pointer-events-none z-0 opacity-90" alt="" />\\n      ')

replace_component("PrivacyPage", '\\n      <img src={IMG.chartGraphNoBg} className="absolute bottom-10 left-10 w-72 h-auto pointer-events-none z-0" alt="" />\\n      <img src={IMG.dots} className="absolute top-16 right-16 w-32 h-auto pointer-events-none z-0 opacity-70" alt="" />\\n      ')

with open("client/src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Updated perfectly!")
