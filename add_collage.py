import sys

with open("client/src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# For OnbWelcome
img1 = '\n      <img src={IMG.origamiStars} className="absolute bottom-10 left-10 w-72 h-auto pointer-events-none" style={{ mixBlendMode: "multiply", opacity: 0.8 }} alt="" />\n      <img src={IMG.megaphone} className="absolute top-10 right-10 w-48 h-auto pointer-events-none" style={{ mixBlendMode: "multiply", opacity: 0.8 }} alt="" />\n      '
content = content.replace(
    '<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5EFE6" }}>\n      <div className="relative mx-auto"',
    '<div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: "#F5EFE6" }}>' + img1 + '<div className="relative mx-auto z-10"',
    1
)

# For OnbAge
img2 = '\n      <img src={IMG.booksStack} className="absolute bottom-0 left-0 w-80 h-auto pointer-events-none" style={{ mixBlendMode: "multiply", opacity: 0.85 }} alt="" />\n      '
content = content.replace(
    '<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5EFE6" }}>\n      <div className="relative mx-auto"',
    '<div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: "#F5EFE6" }}>' + img2 + '<div className="relative mx-auto z-10"',
    1
)

# For GuardianPage
img3 = '\n      <img src={IMG.shieldLock} className="absolute top-20 right-20 w-56 h-auto pointer-events-none" style={{ mixBlendMode: "multiply", opacity: 0.8 }} alt="" />\n      '
content = content.replace(
    '<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5EFE6" }}>\n      <div className="relative mx-auto"',
    '<div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: "#F5EFE6" }}>' + img3 + '<div className="relative mx-auto z-10"',
    1
)

# For PrivacyPage
img4 = '\n      <img src={IMG.chartGraph} className="absolute bottom-10 left-10 w-64 h-auto pointer-events-none" style={{ mixBlendMode: "multiply", opacity: 0.75 }} alt="" />\n      <img src={IMG.handPen} className="absolute bottom-0 right-0 w-56 h-auto pointer-events-none" style={{ mixBlendMode: "multiply", opacity: 0.9 }} alt="" />\n      '
content = content.replace(
    '<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5EFE6" }}>\n      <div className="relative mx-auto"',
    '<div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: "#F5EFE6" }}>' + img4 + '<div className="relative mx-auto z-10"',
    1
)

with open("client/src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Added collage arts!")
