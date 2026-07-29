import re

code = open("client/src/App.tsx", "r", encoding="utf-8").read()

login_page = """function LoginPage({ onNext }: { onNext: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: T.black }}>
      <CheckerStrip className="fixed top-0 left-0 right-0 z-50" />
      
      {/* LEFT: graph paper + collage */}
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{
          width: "53%",
          background: `
            linear-gradient(${T.gridLine} 1px, transparent 1px),
            linear-gradient(90deg, ${T.gridLine} 1px, transparent 1px)
          `,
          backgroundSize: "28px 28px",
          backgroundColor: T.cream,
        }}
      >
        <HalftoneField className="top-0 left-0 bottom-0" style={{ width: "40%" }} />
        <img
          src={IMG.loginCollage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-left-top"
          style={{ mixBlendMode: "multiply", opacity: 0.88 }}
        />
        <RedDotCross className="top-16 right-12 z-10" />
        
        {/* Black curved divider sweeping right */}
        <div className="absolute inset-y-0 right-0" style={{ width: "22%" }}>
          <svg viewBox="0 0 120 100" preserveAspectRatio="none" className="w-full h-full">
            <path d="M120,0 C60,20 20,50 20,100 L120,100 Z" fill={T.black} />
          </svg>
        </div>
      </div>

      {/* RIGHT: black panel with form card */}
      <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center px-8" style={{ width: "47%", backgroundColor: T.black }}>
        {/* Hand-pen collage */}
        <div className="fixed bottom-0 right-0 z-40 pointer-events-none" style={{ width: "200px" }}>
          <img src={IMG.handPen} alt="" className="w-full h-auto" style={{ mixBlendMode: "multiply" }} />
        </div>

        {/* Form card */}
        <div
          style={{
            width: "100%",
            maxWidth: "380px",
            background: "linear-gradient(150deg, #FBCFCA 0%, #FCD5CF 55%, #FDDDD9 100%)",
            borderRadius: "24px",
            padding: "36px 32px",
            boxShadow: "0 12px 60px rgba(0,0,0,0.4)",
            position: "relative",
            zIndex: 10,
          }}
        >
          <p className="text-xl font-semibold mb-1" style={{ fontFamily: "'Noto Sans Thai', sans-serif", color: T.black }}>Welcome To</p>
          <h1 className="text-5xl font-black mb-6" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: T.red, lineHeight: 1.1 }}>JaiKraJok</h1>

          <div
            className="flex mb-5 rounded-2xl overflow-hidden"
            style={{ border: "1.5px solid rgba(26,26,26,0.12)", background: "rgba(255,255,255,0.55)" }}
          >
            <button
              onClick={() => setMode("login")}
              className="flex-1 py-2.5 text-sm font-semibold transition-all"
              style={{
                background: mode === "login" ? T.white : "transparent",
                color: T.black,
                fontFamily: "'Noto Sans Thai', sans-serif",
                borderRight: "1.5px solid rgba(26,26,26,0.12)",
              }}
            >
              Log In
            </button>
            <button
              onClick={() => setMode("signup")}
              className="flex-1 py-2.5 text-sm font-semibold transition-all"
              style={{
                background: mode === "signup" ? T.white : "transparent",
                color: T.black,
                fontFamily: "'Noto Sans Thai', sans-serif",
              }}
            >
              Sign Up
            </button>
          </div>

          <label className="block text-sm font-bold mb-1.5" style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif", color: T.red }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl mb-4 outline-none transition-all focus:ring-2"
            style={{
              backgroundColor: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(0,0,0,0.05)",
              color: T.black,
              fontFamily: "'Noto Sans Thai', sans-serif",
            }}
          />

          <label className="block text-sm font-bold mb-1.5" style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif", color: T.red }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl mb-6 outline-none transition-all focus:ring-2"
            style={{
              backgroundColor: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(0,0,0,0.05)",
              color: T.black,
              fontFamily: "'Noto Sans Thai', sans-serif",
            }}
          />

          <button
            onClick={() => {
              if (!email || !password) { toast("กรุณากรอกอีเมลและรหัสผ่าน"); return; }
              onNext();
            }}
            className="w-full py-3.5 rounded-full font-bold text-white text-base mb-3 transition-all active:scale-[0.97]"
            style={{ backgroundColor: T.red, fontFamily: "'Noto Sans Thai', sans-serif", boxShadow: "0 2px 12px rgba(196,30,58,0.3)" }}
          >
            {mode === "login" ? "Log In" : "Sign Up"}
          </button>

          <div className="text-center text-xs mb-3" style={{ color: "rgba(26,26,26,0.6)", fontFamily: "'Noto Sans Thai', sans-serif" }}>or</div>

          <button
            className="w-full py-3 rounded-full font-bold text-base mb-3 transition-all active:scale-[0.97] bg-white flex items-center justify-center"
            style={{ color: T.black, fontFamily: "'Noto Sans Thai', sans-serif" }}
          >
            Sign Up
          </button>

          <button
            onClick={() => toast("ฟีเจอร์ Google Login กำลังพัฒนา")}
            className="w-full py-3 rounded-full font-bold text-white text-base transition-all active:scale-[0.97] flex items-center justify-center gap-2"
            style={{ backgroundColor: T.red, fontFamily: "'Noto Sans Thai', sans-serif", boxShadow: "0 2px 12px rgba(196,30,58,0.3)" }}
          >
            Log In With Google
            <svg width="16" height="16" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
              <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
              <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
              <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
"""

onb_welcome = """function OnbWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <GraphPaper showDots className="absolute inset-0 w-full h-full" />
      <CheckerStrip className="fixed top-0 left-0 right-0 z-50" />
      
      {/* Black curved left sidebar for consistency */}
      <div className="absolute left-0 top-0 bottom-0 pointer-events-none" style={{ width: "40px", zIndex: 10 }}>
        <svg viewBox="0 0 40 100" preserveAspectRatio="none" className="w-full h-full">
          <path d="M40,0 L0,0 L0,100 L40,100 C15,100 15,0 40,0 Z" fill={T.black} />
        </svg>
      </div>

      <BrainCloud className="absolute top-10 right-[25%] z-10" />
      <RedDotCross className="absolute top-16 right-12 z-10" />
      <div className="fixed bottom-0 right-0 z-20 pointer-events-none" style={{ width: "240px" }}>
        <img src={IMG.handPen} alt="" className="w-full h-auto" style={{ mixBlendMode: "multiply" }} />
      </div>

      <div
        className="relative z-20 mx-auto"
        style={{
          background: T.white,
          borderRadius: "24px",
          padding: "48px",
          maxWidth: "600px",
          width: "100%",
          boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
          border: `2px solid ${T.black}`,
        }}
      >
        <TealBadge text="Welcome" />
        <h2 className="text-3xl font-black mb-4" style={{ fontFamily: "'Playfair Display', serif", color: T.black }}>
          ยินดีต้อนรับสู่ JaiKraJok
        </h2>
        <p className="text-base mb-8 leading-relaxed" style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif", color: "#4a4a4a" }}>
          พื้นที่ปลอดภัยสำหรับแชร์ความรู้สึกของคุณ เราพร้อมรับฟังและเคียงข้างเสมอ
        </p>
        <TealBtn onClick={onNext} text="เริ่มกันเลย" />
      </div>
    </div>
  );
}
"""

onb_age = """function OnbAge({ age, setAge, onNext }: { age: string; setAge: (v: string) => void; onNext: () => void }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <GraphPaper showDots className="absolute inset-0 w-full h-full" />
      <CheckerStrip className="fixed top-0 left-0 right-0 z-50" />

      {/* Black curved left sidebar */}
      <div className="absolute left-0 top-0 bottom-0 pointer-events-none" style={{ width: "40px", zIndex: 10 }}>
        <svg viewBox="0 0 40 100" preserveAspectRatio="none" className="w-full h-full">
          <path d="M40,0 L0,0 L0,100 L40,100 C15,100 15,0 40,0 Z" fill={T.black} />
        </svg>
      </div>
      
      <RedDotCross className="absolute bottom-20 left-[10%] z-10" />

      <OnbCard>
        <TealBadge text="Step 1/3" />
        <h2 className="text-3xl font-black mb-4" style={{ fontFamily: "'Playfair Display', serif", color: T.black }}>
          คุณอายุเท่าไหร่?
        </h2>
        <p className="text-base mb-6" style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif", color: "#4a4a4a" }}>
          เพื่อประสบการณ์ที่เหมาะสมกับคุณ
        </p>
        <input
          type="number"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="ระบุอายุของคุณ"
          className="w-full px-5 py-4 rounded-2xl mb-8 outline-none focus:ring-2 text-lg text-center"
          style={{
            backgroundColor: T.cream,
            border: `2px solid ${T.black}`,
            fontFamily: "'IBM Plex Sans Thai', sans-serif",
            color: T.black,
          }}
        />
        <TealBtn
          onClick={() => {
            if (!age || parseInt(age) <= 0) { toast("กรุณาระบุอายุให้ถูกต้อง"); return; }
            onNext();
          }}
          text="ถัดไป"
        />
      </OnbCard>
    </div>
  );
}
"""

guardian_page = """function GuardianPage({ approved, onSend, onNext, guardianEmail, setGuardianEmail }: any) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <GraphPaper showDots className="absolute inset-0 w-full h-full" />
      <CheckerStrip className="fixed top-0 left-0 right-0 z-50" />
      
      <div className="absolute left-0 top-0 bottom-0 pointer-events-none" style={{ width: "40px", zIndex: 10 }}>
        <svg viewBox="0 0 40 100" preserveAspectRatio="none" className="w-full h-full">
          <path d="M40,0 L0,0 L0,100 L40,100 C15,100 15,0 40,0 Z" fill={T.black} />
        </svg>
      </div>

      <OnbCard>
        <TealBadge text="Step 2/3" />
        <h2 className="text-3xl font-black mb-4" style={{ fontFamily: "'Playfair Display', serif", color: T.black }}>
          ขอความยินยอมจากผู้ปกครอง
        </h2>
        <p className="text-sm mb-6" style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif", color: "#4a4a4a" }}>
          เนื่องจากคุณอายุต่ำกว่า 13 ปี เราจำเป็นต้องได้รับความยินยอมจากผู้ปกครองของคุณ
        </p>
        {!approved ? (
          <div className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="อีเมลผู้ปกครอง"
              value={guardianEmail}
              onChange={(e) => setGuardianEmail(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl outline-none focus:ring-2 text-base"
              style={{ backgroundColor: T.cream, border: `2px solid ${T.black}`, color: T.black, fontFamily: "'IBM Plex Sans Thai', sans-serif" }}
            />
            <button
              onClick={onSend}
              className="w-full py-4 rounded-full font-bold text-white text-base transition-all active:scale-[0.97]"
              style={{ backgroundColor: T.black, fontFamily: "'Noto Sans Thai', sans-serif" }}
            >
              ส่งคำขอความยินยอม
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-2xl text-center" style={{ backgroundColor: "#E8F5E9", border: "2px solid #4CAF50", color: "#2E7D32", fontFamily: "'Noto Sans Thai', sans-serif", fontWeight: "bold" }}>
              ✓ ได้รับความยินยอมแล้ว
            </div>
            <TealBtn onClick={onNext} text="ถัดไป" />
          </div>
        )}
      </OnbCard>
    </div>
  );
}
"""

privacy_page = """function PrivacyPage({ onNext }: { onNext: () => void }) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <GraphPaper showDots className="absolute inset-0 w-full h-full" />
      <CheckerStrip className="fixed top-0 left-0 right-0 z-50" />
      
      <div className="absolute left-0 top-0 bottom-0 pointer-events-none" style={{ width: "40px", zIndex: 10 }}>
        <svg viewBox="0 0 40 100" preserveAspectRatio="none" className="w-full h-full">
          <path d="M40,0 L0,0 L0,100 L40,100 C15,100 15,0 40,0 Z" fill={T.black} />
        </svg>
      </div>

      <OnbCard>
        <TealBadge text="Step 3/3" />
        <h2 className="text-3xl font-black mb-4" style={{ fontFamily: "'Playfair Display', serif", color: T.black }}>
          นโยบายความเป็นส่วนตัว
        </h2>
        <div
          className="mb-6 p-5 rounded-2xl text-sm leading-relaxed overflow-y-auto"
          style={{
            backgroundColor: T.cream,
            border: `2px solid ${T.black}`,
            height: "180px",
            color: "#4a4a4a",
            fontFamily: "'IBM Plex Sans Thai', sans-serif",
          }}
        >
          <p className="mb-3">เราให้ความสำคัญกับความเป็นส่วนตัวของคุณ ข้อมูลทั้งหมดที่คุณแชร์ใน JaiKraJok จะถูกเก็บรักษาเป็นความลับและปลอดภัย</p>
          <p className="mb-3">1. ข้อมูลส่วนบุคคลจะถูกใช้เพื่อปรับปรุงประสบการณ์ของคุณเท่านั้น</p>
          <p className="mb-3">2. เราไม่มีนโยบายส่งต่อข้อมูลของคุณให้กับบุคคลที่สาม</p>
          <p>3. คุณสามารถขอลบข้อมูลของคุณได้ตลอดเวลาผ่านเมนูตั้งค่า</p>
        </div>
        <TealBtn onClick={onNext} text="ยอมรับและเข้าสู่ระบบ" />
      </OnbCard>
    </div>
  );
}
"""

start_idx = code.find("/* ============ LOGIN PAGE ============ */")
end_idx = code.find("/* ============ MAIN APP SHELL ============ */")

if start_idx != -1 and end_idx != -1:
    new_content = code[:start_idx] + "/* ============ LOGIN PAGE ============ */\n" + login_page + "\n" + onb_welcome + "\n" + onb_age + "\n" + guardian_page + "\n" + privacy_page + "\n" + code[end_idx:]
    open("client/src/App.tsx", "w", encoding="utf-8").write(new_content)
    print("Replaced successfully!")
else:
    print("Could not find boundaries")
