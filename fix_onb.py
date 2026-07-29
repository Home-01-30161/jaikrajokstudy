import re

code = open("client/src/App.tsx", "r", encoding="utf-8").read()

new_onboarding = """function OnbWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5EFE6" }}>
      <div className="relative mx-auto" style={{ background: "#ffffff", borderRadius: "20px", padding: "48px 56px", maxWidth: "600px", width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.05)" }}>
        <div className="w-10 h-3.5 rounded-full mb-6" style={{ border: '1px solid #2D6A6F' }} />
        <h2 className="text-[2.2rem] font-black mb-4" style={{ fontFamily: "'Playfair Display', serif", color: "#1a1a1a" }}>
          ยินดีต้อนรับสู่ JaiKraJok
        </h2>
        <p className="text-base mb-12" style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif", color: "#4a4a4a" }}>
          พื้นที่ปลอดภัยสำหรับแชร์ความรู้สึกของคุณ เราพร้อมรับฟังและเคียงข้างเสมอ
        </p>
        <button onClick={onNext} className="px-8 py-3 rounded-full transition-all active:scale-[0.97]" style={{ backgroundColor: "#2D6A6F" }}>
          <span style={{ color: "#ffffff", fontWeight: "bold", fontFamily: "'Noto Sans Thai', sans-serif" }}>เริ่มกันเลย</span>
        </button>
      </div>
    </div>
  );
}

function OnbAge({ age, setAge, onNext }: { age: string; setAge: (v: string) => void; onNext: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5EFE6" }}>
      <div className="relative mx-auto" style={{ background: "#ffffff", borderRadius: "20px", padding: "48px 56px", maxWidth: "600px", width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.05)" }}>
        <div className="w-10 h-3.5 rounded-full mb-6" style={{ border: '1px solid #2D6A6F' }} />
        <h2 className="text-[2.2rem] font-black mb-4" style={{ fontFamily: "'Playfair Display', serif", color: "#1a1a1a" }}>
          คุณอายุเท่าไหร่?
        </h2>
        <p className="text-base mb-10" style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif", color: "#4a4a4a" }}>
          เพื่อประสบการณ์ที่เหมาะสมกับคุณ
        </p>
        <input
          type="number"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="ระบุอายุของคุณ"
          className="w-full px-5 py-4 rounded-2xl mb-10 outline-none focus:ring-2 text-lg text-center"
          style={{ backgroundColor: "#EBE5DC", border: "2px solid #1a1a1a", fontFamily: "'IBM Plex Sans Thai', sans-serif", color: "#1a1a1a" }}
        />
        <button onClick={() => { if (!age || parseInt(age) <= 0) return; onNext(); }} className="px-8 py-3 rounded-full transition-all active:scale-[0.97]" style={{ backgroundColor: "#2D6A6F" }}>
          <span style={{ color: "#ffffff", fontWeight: "bold", fontFamily: "'Noto Sans Thai', sans-serif" }}>ถัดไป</span>
        </button>
      </div>
    </div>
  );
}

function GuardianPage({ approved, onSend, onNext, guardianEmail, setGuardianEmail }: any) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5EFE6" }}>
      <div className="relative mx-auto" style={{ background: "#ffffff", borderRadius: "20px", padding: "48px 56px", maxWidth: "600px", width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.05)" }}>
        <div className="w-10 h-3.5 rounded-full mb-6" style={{ border: '1px solid #2D6A6F' }} />
        <h2 className="text-[2.2rem] font-black mb-4" style={{ fontFamily: "'Playfair Display', serif", color: "#1a1a1a" }}>
          ขอความยินยอมจากผู้ปกครอง
        </h2>
        <p className="text-base mb-8 leading-relaxed" style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif", color: "#4a4a4a" }}>
          เนื่องจากคุณอายุต่ำกว่า 13 ปี เราจำเป็นต้องได้รับความยินยอมจากผู้ปกครองของคุณ
        </p>
        {!approved ? (
          <div className="flex flex-col gap-6">
            <input
              type="email"
              placeholder="อีเมลผู้ปกครอง"
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl outline-none focus:ring-2 text-base"
              style={{ backgroundColor: "#EBE5DC", border: "2px solid #1a1a1a", color: "#1a1a1a", fontFamily: "'IBM Plex Sans Thai', sans-serif" }}
            />
            <button onClick={onSend} className="w-full py-4 rounded-full font-bold text-white text-base transition-all active:scale-[0.97]" style={{ backgroundColor: "#1a1a1a", fontFamily: "'Noto Sans Thai', sans-serif" }}>
              ส่งคำขอความยินยอม
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="p-5 rounded-2xl text-center" style={{ backgroundColor: "#E8F5E9", border: "2px solid #4CAF50", color: "#2E7D32", fontFamily: "'Noto Sans Thai', sans-serif", fontWeight: "bold" }}>
              ✓ ได้รับความยินยอมแล้ว
            </div>
            <button onClick={onNext} className="w-full py-4 rounded-full font-bold text-white text-base transition-all active:scale-[0.97]" style={{ backgroundColor: "#2D6A6F", fontFamily: "'Noto Sans Thai', sans-serif" }}>
              ถัดไป
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PrivacyPage({ onNext }: { onNext: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F5EFE6" }}>
      <div className="relative mx-auto" style={{ background: "#ffffff", borderRadius: "20px", padding: "48px 56px", maxWidth: "600px", width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.05)" }}>
        <div className="w-10 h-3.5 rounded-full mb-6" style={{ border: '1px solid #2D6A6F' }} />
        <h2 className="text-[2.2rem] font-black mb-4" style={{ fontFamily: "'Playfair Display', serif", color: "#1a1a1a" }}>
          นโยบายความเป็นส่วนตัว
        </h2>
        <div
          className="mb-8 p-6 rounded-2xl text-sm leading-relaxed overflow-y-auto"
          style={{
            backgroundColor: "#EBE5DC",
            border: "2px solid #1a1a1a",
            height: "220px",
            color: "#4a4a4a",
            fontFamily: "'IBM Plex Sans Thai', sans-serif",
          }}
        >
          <p className="mb-4">เราให้ความสำคัญกับความเป็นส่วนตัวของคุณ ข้อมูลทั้งหมดที่คุณแชร์ใน JaiKraJok จะถูกเก็บรักษาเป็นความลับและปลอดภัย</p>
          <p className="mb-4">1. ข้อมูลส่วนบุคคลจะถูกใช้เพื่อปรับปรุงประสบการณ์ของคุณเท่านั้น</p>
          <p className="mb-4">2. เราไม่มีนโยบายส่งต่อข้อมูลของคุณให้กับบุคคลที่สาม</p>
          <p>3. คุณสามารถขอลบข้อมูลของคุณได้ตลอดเวลาผ่านเมนูตั้งค่า</p>
        </div>
        <button onClick={onNext} className="px-8 py-3 rounded-full transition-all active:scale-[0.97]" style={{ backgroundColor: "#2D6A6F" }}>
          <span style={{ color: "#ffffff", fontWeight: "bold", fontFamily: "'Noto Sans Thai', sans-serif" }}>ยอมรับและเข้าสู่ระบบ</span>
        </button>
      </div>
    </div>
  );
}
"""

start_idx = code.find("function OnbWelcome")
end_idx = code.find("/* ============ MAIN APP SHELL ============ */")

if start_idx != -1 and end_idx != -1:
    new_content = code[:start_idx] + new_onboarding + "\n" + code[end_idx:]
    open("client/src/App.tsx", "w", encoding="utf-8").write(new_content)
    print("Replaced successfully!")
else:
    print("Could not find boundaries")
