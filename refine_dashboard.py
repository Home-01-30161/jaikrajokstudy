import re

with open('client/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Hero Card
old_hero = r'''      <div
        className="p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
        style={{
          background: T.white,
          borderRadius: "20px",
          border: "1.5px solid #E2D9C2",
          boxShadow: "0 2px 18px rgba(26,26,26,0.07)",
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
            style={{ backgroundColor: EMO\[mood\]\?.bg \|\| "#E3EAE0", border: `2px solid \$\{T.teal\}` }}
          >
            \{EMO\[mood\]\?.emoji \|\| "😌"\}
          </div>'''

new_hero = '''      <div
        className="p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden"
        style={{
          background: "#fefdfa",
          backgroundImage: "radial-gradient(#e0d6c8 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          borderRadius: "16px",
          border: "2px solid #DED3C1",
          boxShadow: "4px 8px 0px rgba(222,211,193,0.4), 0 4px 24px rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex items-center gap-5 z-10">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl flex-shrink-0 -mt-2 -ml-2 shadow-lg z-10 relative"
            style={{ backgroundColor: EMO[mood]?.bg || "#E3EAE0", border: `3px solid ${T.white}` }}
          >
            {EMO[mood]?.emoji || "😌"}
            <div className="absolute inset-0 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] pointer-events-none"></div>
          </div>'''

content = re.sub(old_hero, new_hero, content)

# 2. Quick Mood Picker (6 tiles)
old_mood = r'''          \{moods\.map\(\(\[key, emo\]\) => \(
            <button
              key=\{key\}
              onClick=\{\(\) => setMood\(key\)\}
              className="p-3.5 rounded-2xl text-center transition-all active:scale-\[0.97\]"
              style=\{\{
                backgroundColor: mood === key \? "#DCEAE8" : T.white,
                border: mood === key \? `2\.5px solid \$\{T\.teal\}` : "2px solid #EDE6D3",
                fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif",
              \}\}
            >
              <span className="text-3xl block mb-1.5">\{emo\.emoji\}</span>
              <span className="text-xs font-bold block" style=\{\{ color: T\.black \}\}>\{emo\.label\}</span>
            </button>
          \)\)\}'''

new_mood = '''          {moods.map(([key, emo], idx) => {
            const rotations = ["rotate-[-2deg]", "rotate-[1deg]", "rotate-[-1deg]", "rotate-[2deg]", "rotate-[0deg]", "rotate-[-3deg]"];
            const rot = rotations[idx % rotations.length];
            return (
            <button
              key={key}
              onClick={() => setMood(key)}
              className={`p-4 rounded-xl text-center transition-all duration-300 transform hover:-translate-y-2 hover:shadow-xl active:scale-95 ${rot}`}
              style={{
                backgroundColor: mood === key ? "#DCEAE8" : T.white,
                border: mood === key ? `3px solid ${T.teal}` : "1px solid #EDE6D3",
                boxShadow: mood === key ? "0 8px 0px rgba(45,106,111,0.2)" : "0 4px 10px rgba(0,0,0,0.05)",
                fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif",
              }}
            >
              <span className="text-4xl block mb-2 drop-shadow-sm">{emo.emoji}</span>
              <span className="text-[11px] font-bold block uppercase tracking-wide" style={{ color: mood === key ? T.teal : T.black }}>{emo.label}</span>
            </button>
          )})}'''

content = re.sub(old_mood, new_mood, content)


# 3. Action Cards (Camera, Keyboard, Mic, Photo)
old_action_cards = r'''        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          \{\[
            \{ id: "camera" as const, title: "ถ่ายเซลฟี่", desc: "อ่านสีหน้าและอารมณ์ผ่าน Face Recognition API", icon: "📷" \},
            \{ id: "keyboard" as const, title: "พิมพ์ความรู้สึก", desc: "วิเคราะห์น้ำเสียงข้อความด้วย Sentiment Analysis API", icon: "⌨️" \},
            \{ id: "mic" as const, title: "พูดระบาย", desc: "แปลงเสียงพูดเป็นข้อความผ่าน Speech-to-Text API", icon: "🎤" \},
            \{ id: "photo" as const, title: "ถ่ายรูปการบ้าน", desc: "อ่านและช่วยอธิบายเนื้อหาด้วย OCR API", icon: "🖼️" \},
          \]\.map\(\(item\) => \(
            <button
              key=\{item\.id\}
              onClick=\{\(\) => tryMode\(item\.id\)\}
              className="p-5 rounded-2xl text-left group transition-all hover:-translate-y-1 active:scale-\[0.97\]"
              style=\{\{
                backgroundColor: T\.white,
                border: `1\.5px solid \$\{T\.teal\}`,
                boxShadow: "0 2px 12px rgba\(26,26,26,0\.07\)",
              \}\}
            >
              <span className="text-3xl block mb-2">\{item\.icon\}</span>
              <h4 className="font-bold text-sm mb-1" style=\{\{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T\.black \}\}>
                \{item\.title\}
              </h4>
              <p className="text-xs mb-3 leading-normal" style=\{\{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: "#666" \}\}>
                \{item\.desc\}
              </p>
              <span className="text-xs font-bold" style=\{\{ fontFamily: "'IBM Plex Mono', monospace", color: T\.teal \}\}>
                ลองเลย ↗
              </span>
            </button>
          \)\)\}'''

new_action_cards = '''        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { id: "camera" as const, title: "ถ่ายเซลฟี่", desc: "Face Recognition API", icon: "📷", bg: "#FDF5E6", border: "#F0E1C8" },
            { id: "keyboard" as const, title: "พิมพ์ความรู้สึก", desc: "Sentiment Analysis API", icon: "⌨️", bg: "#F2F5E9", border: "#E0E8D3" },
            { id: "mic" as const, title: "พูดระบาย", desc: "Speech-to-Text API", icon: "🎤", bg: "#FFF0F4", border: "#F5DBE4" },
            { id: "photo" as const, title: "ถ่ายรูปการบ้าน", desc: "OCR API", icon: "🖼️", bg: "#EBF3F5", border: "#D4E5E8" },
          ].map((item, idx) => {
            const rots = ["rotate-[1deg]", "rotate-[-1deg]", "rotate-[2deg]", "rotate-[-2deg]"];
            const r = rots[idx % rots.length];
            return (
            <button
              key={item.id}
              onClick={() => tryMode(item.id)}
              className={`p-6 rounded-none text-center group transition-all duration-300 transform hover:-translate-y-3 hover:scale-105 active:scale-95 ${r}`}
              style={{
                backgroundColor: item.bg,
                border: `1px solid ${item.border}`,
                boxShadow: `4px 4px 0px ${item.border}, 0 10px 20px rgba(0,0,0,0.05)`,
                position: "relative"
              }}
            >
              {/* Tape visual */}
              <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 w-12 h-6 bg-white/40 border border-white/60 shadow-sm rotate-[-2deg]" style={{backdropFilter: "blur(2px)"}}></div>
              
              <div className="bg-white rounded-sm aspect-square flex items-center justify-center mb-4 shadow-inner" style={{ border: `1px solid ${item.border}`}}>
                 <span className="text-5xl drop-shadow-md group-hover:scale-110 transition-transform duration-300">{item.icon}</span>
              </div>
              <h4 className="font-bold text-sm mb-1" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: T.black }}>
                {item.title}
              </h4>
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ fontFamily: "'Inter', 'Inter', 'Noto Sans Thai', sans-serif", color: "#888" }}>
                {item.desc}
              </p>
            </button>
          )})}'''

content = re.sub(old_action_cards, new_action_cards, content)

# 4. LINE Notification Card
old_line = r'''      <div
        className="p-4 rounded-xl flex items-center justify-between"
        style=\{\{ backgroundColor: T\.white, border: "1.5px solid #E2D9C2" \}\}
      >
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">💚 LINE Official Account</span>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">🌐 Web Application \(หน้านี้\)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-gray-700">รับการแจ้งเตือนผ่าน LINE</span>
          <button
            onClick=\{\(\) => setLineNotify\(!lineNotify\)\}
            className="w-12 h-6 rounded-full flex items-center transition-colors px-1"
            style=\{\{ backgroundColor: lineNotify \? "#00B900" : "#ccc" \}\}
          >
            <div className={`w-4 h-4 bg-white rounded-full transition-transform \$\{lineNotify \? "translate-x-6" : "translate-x-0"\}`} />
          </button>
        </div>
      </div>'''

new_line = '''      <div
        className="p-6 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative mt-4"
        style={{ 
          backgroundColor: "#F9F8F5", 
          border: "2px dashed #C8BEAC",
          backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(200, 190, 172, 0.05) 10px, rgba(200, 190, 172, 0.05) 20px)"
        }}
      >
        {/* Pin visual */}
        <div className="absolute top-2 right-4 w-3 h-3 rounded-full bg-[#A85F73] shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
          <div className="w-1 h-1 bg-white/60 rounded-full absolute top-[1px] left-[1px]"></div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="px-4 py-1.5 text-[#00B900] text-xs font-bold rounded-sm border border-[#00B900] bg-white shadow-sm" style={{transform: "rotate(-1deg)"}}>💚 LINE Official</span>
          <span className="px-4 py-1.5 text-blue-600 text-xs font-bold rounded-sm border border-blue-600 bg-white shadow-sm" style={{transform: "rotate(1deg)"}}>🌐 Web App</span>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 px-4 rounded-full border border-[#E2D9C2] shadow-sm">
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">แจ้งเตือนผ่าน LINE</span>
          <button
            onClick={() => setLineNotify(!lineNotify)}
            className="w-10 h-5 rounded-full flex items-center transition-colors px-0.5"
            style={{ backgroundColor: lineNotify ? "#00B900" : "#D1D5DB", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)" }}
          >
            <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${lineNotify ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
      </div>'''

content = re.sub(old_line, new_line, content)

with open('client/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Dashboard rewritten!")
