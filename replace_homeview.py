import re

with open('client/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = '  return (\n    // Break-out wrapper \u2014 full cream editorial canvas'
end_marker = '\n\n\n/* ============ CHAT VIEW ============ */'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f"ERROR: start={start_idx}, end={end_idx}")
    exit(1)

new_homeview_return = r'''  return (
    <div style={{ margin: "-1.75rem -1.25rem", marginTop: "-1.5rem", backgroundColor: CREAM }} className="md:!-mx-8 md:!-my-7 overflow-x-hidden">

      {/* HERO: Aardvark editorial cream warmth + Pieter typography scale */}
      <section
        id="hv-hero"
        style={{
          position: "relative",
          overflow: "hidden",
          backgroundColor: CREAM,
          backgroundImage: `linear-gradient(${GRID} 1px, transparent 1px), linear-gradient(90deg, ${GRID} 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      >
        {/* Top metadata strip */}
        <div
          id="hv-kicker"
          style={{
            position: "relative", zIndex: 2,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "1.5rem clamp(1.5rem, 5vw, 4rem)",
            borderBottom: `1px solid rgba(26,20,10,0.1)`,
          }}
        >
          <span style={{ fontFamily: SF, fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: INK_MUTED }}>{todayThai}</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: PINK, boxShadow: `0 0 8px ${PINK}` }} />
            <span style={{ fontFamily: SF, fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: INK_MUTED }}>กำลังทำงาน</span>
          </div>
        </div>

        {/* Main hero: big type left, collage right */}
        <div style={{ display: "flex", flexWrap: "wrap", minHeight: "clamp(460px, 68vh, 740px)", position: "relative", zIndex: 2 }}>

          {/* LEFT column: display typography */}
          <div style={{
            flex: "1 1 420px",
            display: "flex", flexDirection: "column", justifyContent: "center",
            padding: "3rem clamp(1.5rem, 5vw, 4rem) 4rem",
          }}>
            <p style={{
              fontFamily: SF, fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.2em",
              textTransform: "uppercase", color: PINK, margin: "0 0 1.5rem",
              display: "flex", alignItems: "center", gap: "0.5rem"
            }}>
              <span style={{ display: "inline-block", width: "28px", height: "2px", background: PINK, borderRadius: "2px" }} />
              {greeting}
            </p>

            <h1
              id="hv-headline"
              style={{
                fontFamily: SF,
                fontSize: "clamp(4rem, 9vw, 9.5rem)",
                fontWeight: 900,
                lineHeight: 0.9,
                letterSpacing: "-0.04em",
                color: INK,
                margin: "0 0 1.75rem",
                maxWidth: "12ch",
              }}
            >
              กระจก
              <br />
              <span style={{ color: PINK }}>สะท้อนใจ</span>
            </h1>

            <p style={{
              fontFamily: SF,
              fontSize: "clamp(0.9rem, 1.6vw, 1.05rem)",
              lineHeight: 1.7,
              color: INK_MUTED,
              margin: "0 0 2.5rem",
              maxWidth: "36ch",
              borderLeft: `3px solid ${PINK}`,
              paddingLeft: "1rem",
            }}>
              พื้นที่ส่วนตัวเพื่อบันทึกความรู้สึก — พิมพ์ พูด หรือถ่ายภาพ กระจกรับฟังทุกอย่าง
            </p>

            <div id="hv-ctas" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                onClick={onGoChat}
                style={{
                  fontFamily: SF, fontWeight: 800, fontSize: "0.9rem",
                  background: INK, color: CREAM,
                  border: "none", borderRadius: "9999px",
                  padding: "0.9rem 2rem", cursor: "pointer",
                  letterSpacing: "-0.01em",
                  display: "inline-flex", alignItems: "center", gap: "0.5rem",
                  transition: "background 0.2s, transform 0.2s",
                  boxShadow: "0 4px 20px rgba(26,20,10,0.15)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = PINK; (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.03)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = INK; (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
              >
                เริ่มคุยกับกระจก
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
              <button
                onClick={onGoTrend}
                style={{
                  fontFamily: SF, fontWeight: 700, fontSize: "0.9rem",
                  background: "transparent", color: INK,
                  border: `2px solid rgba(26,20,10,0.22)`, borderRadius: "9999px",
                  padding: "0.88rem 2rem", cursor: "pointer",
                  letterSpacing: "-0.01em",
                  transition: "border-color 0.2s, color 0.2s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = PINK; (e.currentTarget as HTMLButtonElement).style.color = PINK; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(26,20,10,0.22)"; (e.currentTarget as HTMLButtonElement).style.color = INK; }}
              >
                ดูแนวโน้มของฉัน
              </button>
            </div>
          </div>

          {/* RIGHT column: collage editorial */}
          <div
            id="hv-img"
            style={{
              flex: "0 1 400px",
              position: "relative",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              overflow: "hidden",
              minHeight: "320px",
            }}
          >
            <div style={{
              position: "absolute",
              bottom: "-80px", right: "-80px",
              width: "420px", height: "420px",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${PINK}12 0%, transparent 65%)`,
              zIndex: 0,
            }} />
            <div style={{
              position: "absolute", top: "2rem", left: "2.5rem",
              fontFamily: SERIF, fontSize: "6rem", fontWeight: 900,
              color: PINK, opacity: 0.1, lineHeight: 1, zIndex: 0, userSelect: "none",
            }}>✦</div>
            <img
              src={IMG.glasses}
              alt=""
              aria-hidden="true"
              style={{
                width: "clamp(200px, 30vw, 400px)",
                objectFit: "contain",
                zIndex: 1,
                position: "relative",
                filter: "drop-shadow(0 24px 48px rgba(26,20,10,0.16))",
                mixBlendMode: "multiply",
                opacity: 0.9,
              }}
            />
            <div style={{
              position: "absolute", bottom: "2.5rem", right: "1.5rem",
              fontFamily: `'Mali', 'Noto Sans Thai', cursive`,
              fontSize: "0.78rem", color: INK_MUTED,
              transform: "rotate(-8deg)", zIndex: 2,
              opacity: 0.6,
            }}>กระจกของฉัน ↗</div>
          </div>
        </div>

        <div style={{ height: "1px", background: `rgba(26,20,10,0.1)` }} />
      </section>

      {/* MODE GALLERY HEADER — cream editorial strip */}
      <div className="hv-strip" style={{
        background: CREAM,
        backgroundImage: `linear-gradient(${GRID} 1px, transparent 1px), linear-gradient(90deg, ${GRID} 1px, transparent 1px)`,
        backgroundSize: "32px 32px",
        borderBottom: `1px solid rgba(26,20,10,0.1)`,
        padding: "1.5rem clamp(1.5rem, 5vw, 4rem)",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <span style={{ fontFamily: SF, fontSize: "1.35rem", fontWeight: 800, color: INK, letterSpacing: "-0.03em" }}>เลือกวิธีบอกเรา</span>
          <span style={{ fontFamily: SF, fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.16em", color: INK_MUTED, textTransform: "uppercase" }}>04 โหมด</span>
        </div>
        <svg width="60" height="12" viewBox="0 0 60 12" fill="none" style={{ opacity: 0.4 }}>
          <path d="M0 6 Q7.5 0 15 6 Q22.5 12 30 6 Q37.5 0 45 6 Q52.5 12 60 6" stroke={PINK} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        </svg>
      </div>

      {/* MODE GALLERY: Accordion in black — dramatic cream-to-black contrast */}
      <div
        className="hv-strip"
        style={{
          display: "flex",
          flexDirection: "row",
          height: "clamp(500px, 68vh, 740px)",
          background: BLACK,
          overflow: "hidden"
        }}
      >
        {modes.map((item, idx) => {
          const isHovered = hoveredMode === item.id;
          const isAnyHovered = hoveredMode !== null;
          const flexGrow = isHovered ? 3.5 : isAnyHovered ? 0.4 : 1;

          return (
            <button
              key={item.id}
              onClick={() => tryMode(item.id)}
              onMouseEnter={() => setHoveredMode(item.id)}
              onMouseLeave={() => setHoveredMode(null)}
              onFocus={() => setHoveredMode(item.id)}
              onBlur={() => setHoveredMode(null)}
              aria-label={`${item.th} \u2014 ${item.sub}`}
              style={{
                flex: flexGrow,
                transition: "flex 0.65s cubic-bezier(0.25, 1, 0.25, 1)",
                background: "transparent",
                position: "relative",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                minWidth: 0,
                border: "none",
                outline: "none",
                borderRight: idx < 3 ? "1px solid rgba(240,239,233,0.06)" : "none",
              }}
            >
              <div style={{
                position: "absolute", inset: 0,
                background: `radial-gradient(ellipse at 50% 70%, ${PINK}15 0%, transparent 65%)`,
                opacity: isHovered ? 1 : 0,
                transition: "opacity 0.5s ease",
                zIndex: 0
              }} />
              <div style={{
                position: "absolute", inset: 0,
                background: "rgba(8,9,10,0.62)",
                opacity: isAnyHovered && !isHovered ? 1 : 0,
                transition: "opacity 0.55s ease",
                zIndex: 1
              }} />
              <div style={{
                position: "absolute", top: "1.25rem", left: "1.5rem",
                fontFamily: SF, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.16em",
                color: isHovered ? PINK : "rgba(245,240,232,0.9)",
                opacity: isAnyHovered && !isHovered ? 0.15 : isHovered ? 1 : 0.4,
                transition: "all 0.45s ease",
                zIndex: 5
              }}>{String(idx + 1).padStart(2, "0")}</div>

              <img
                src={item.img}
                alt={item.th}
                style={{
                  width: "clamp(120px, 18vw, 240px)",
                  height: "clamp(120px, 18vw, 240px)",
                  objectFit: "contain",
                  transition: "all 0.65s cubic-bezier(0.25, 1, 0.25, 1)",
                  transform: isHovered ? "scale(1.14) translateY(-8px)" : "scale(1)",
                  filter: isHovered
                    ? `drop-shadow(0 28px 44px rgba(0,0,0,0.8)) drop-shadow(0 0 30px ${PINK}44) brightness(1.08)`
                    : "drop-shadow(0 10px 22px rgba(0,0,0,0.55)) brightness(0.92) grayscale(0.12)",
                  zIndex: 2,
                  position: "relative",
                  flexShrink: 0
                }}
              />

              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "2.5rem 1.5rem 1.5rem",
                background: "linear-gradient(to top, rgba(8,9,10,0.95) 0%, transparent 100%)",
                transition: "all 0.45s ease",
                opacity: isHovered ? 0 : 1,
                transform: isHovered ? "translateY(8px)" : "translateY(0)",
                zIndex: 3,
                textAlign: "center"
              }}>
                <p style={{ fontFamily: SF, fontSize: "clamp(0.65rem, 1.4vw, 0.82rem)", fontWeight: 700, color: "rgba(245,240,232,0.95)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>
                  {item.th}
                </p>
              </div>

              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "3rem 2rem 2rem",
                background: "linear-gradient(to top, rgba(8,9,10,0.98) 0%, rgba(8,9,10,0.6) 55%, transparent 100%)",
                transition: "all 0.6s cubic-bezier(0.25, 1, 0.25, 1)",
                opacity: isHovered ? 1 : 0,
                transform: isHovered ? "translateY(0)" : "translateY(20px)",
                pointerEvents: "none",
                zIndex: 4,
                textAlign: "left"
              }}>
                <p style={{ fontFamily: SF, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: PINK, margin: "0 0 0.5rem" }}>
                  {item.sub}
                </p>
                <h2 style={{ fontFamily: SF, fontSize: "clamp(1.5rem, 3.5vw, 3rem)", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.035em", color: CREAM, margin: "0 0 1rem" }}>
                  {item.th}
                </h2>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: PINK, color: BLACK, borderRadius: "9999px", padding: "0.4rem 1.1rem", fontSize: "0.78rem", fontWeight: 800, fontFamily: SF }}>
                  เริ่มเลย
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </div>

              {idx < 3 && (
                <div style={{
                  position: "absolute", right: 0, top: "10%", height: "80%", width: "1px",
                  background: "rgba(240,239,233,0.06)",
                  zIndex: 5
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* FOOTER: LINE Notify — cream editorial strip */}
      <div className="hv-strip" style={{
        background: CREAM,
        backgroundImage: `linear-gradient(${GRID} 1px, transparent 1px), linear-gradient(90deg, ${GRID} 1px, transparent 1px)`,
        backgroundSize: "32px 32px",
        borderTop: `1px solid rgba(26,20,10,0.1)`,
        padding: "1.75rem clamp(1.5rem, 5vw, 4rem)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.5rem", flexWrap: "wrap"
      }}>
        <div>
          <p style={{ fontFamily: SF, fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: INK_MUTED, margin: "0 0 0.3rem" }}>การแจ้งเตือน</p>
          <p style={{ fontFamily: SF, fontSize: "1rem", fontWeight: 700, color: INK, margin: 0 }}>รับการแจ้งเตือนผ่าน LINE</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontFamily: SF, fontSize: "0.82rem", fontWeight: 700, color: lineNotify ? PINK : INK_MUTED }}>
            {lineNotify ? "เปิดอยู่" : "ปิดอยู่"}
          </span>
          <button
            onClick={() => { setLineNotify(!lineNotify); toast(lineNotify ? "ปิดการแจ้งเตือน LINE แล้ว" : "เปิดการแจ้งเตือน LINE แล้ว"); }}
            aria-label="สลับการแจ้งเตือน LINE"
            style={{
              width: "52px", height: "28px", borderRadius: "9999px", border: "none",
              background: lineNotify ? PINK : "rgba(26,20,10,0.12)",
              cursor: "pointer", position: "relative", transition: "background 0.3s ease",
            }}
          >
            <div style={{
              width: "20px", height: "20px", borderRadius: "50%", background: lineNotify ? BLACK : "rgba(26,20,10,0.35)",
              position: "absolute", top: "4px", transition: "left 0.3s ease",
              left: lineNotify ? "28px" : "4px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
            }} />
          </button>
        </div>
      </div>
    </div>
  );
}

'''

new_content = content[:start_idx] + new_homeview_return + content[end_idx:]

with open('client/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Done! File written successfully.")
print(f"Original chars: {len(content)}, New chars: {len(new_content)}")
