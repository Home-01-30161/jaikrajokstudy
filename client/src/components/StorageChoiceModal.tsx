import React from "react";
import { setStoragePref, StoragePref } from "../lib/storagePref";

interface Props {
  onSelect: (pref: StoragePref) => void;
}

export function StorageChoiceModal({ onSelect }: Props) {
  const handleChoice = (pref: StoragePref) => {
    setStoragePref(pref);
    onSelect(pref);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(26, 18, 8, 0.75)", backdropFilter: "blur(4px)" }}>
      <div
        className="w-full max-w-lg p-6 relative shadow-2xl"
        style={{
          backgroundColor: "#FAFAF7",
          border: "2px solid #1A1208",
          boxShadow: "6px 6px 0px #1A1208",
        }}
      >
        {/* Header / Badge */}
        <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: "1.5px solid #C4B88A" }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 20 }}>🛡️</span>
            <h3 style={{ fontFamily: "'Sarabun', sans-serif", fontSize: 18, fontWeight: 700, color: "#1A1208" }}>
              การจัดเก็บข้อมูลความเป็นส่วนตัว (PDPA)
            </h3>
          </div>
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              fontWeight: 700,
              color: "#EDE8DC",
              backgroundColor: "#3D6B5A",
              padding: "2px 8px",
              letterSpacing: "0.05em",
            }}
          >
            PDPA SECURE
          </span>
        </div>

        <p style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 13, color: "#1A120899", lineHeight: 1.6, marginBottom: 20 }}>
          เพื่อการปฏิบัติตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA) คุณสามารถเลือกสถานที่จัดเก็บประวัติการสนทนาและข้อมูลอารมณ์ของคุณได้ตามต้องการ:
        </p>

        {/* Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Option 1: Local Storage */}
          <button
            onClick={() => handleChoice("local")}
            className="flex flex-col justify-between p-4 text-left transition-all hover:-translate-y-0.5 active:translate-y-0 group cursor-pointer"
            style={{
              backgroundColor: "#F7F4EE",
              border: "2px solid #1A1208",
              boxShadow: "3px 3px 0px #1A1208",
            }}
          >
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: 24 }}>📱</span>
                <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#5B7036" }}>RECOMMENDED FOR PRIVACY</span>
              </div>
              <h4 style={{ fontFamily: "'Sarabun', sans-serif", fontSize: 15, fontWeight: 700, color: "#1A1208", marginBottom: 6 }}>
                เก็บบนอุปกรณ์นี้เท่านั้น (Local)
              </h4>
              <p style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 12, color: "#1A120888", lineHeight: 1.5 }}>
                ประวัติแชทจะถูกบันทึกในเบราว์เซอร์ของคุณเท่านั้น ไม่ส่งขึ้นเซิร์ฟเวอร์คลาวด์ ปลอดภัยสูงสุด
              </p>
            </div>
            <div
              className="mt-4 py-2 text-center transition-colors group-hover:bg-[#5B7036] group-hover:text-white"
              style={{
                fontFamily: "'Sarabun', sans-serif",
                fontSize: 13,
                fontWeight: 700,
                color: "#1A1208",
                border: "1.5px solid #1A1208",
                backgroundColor: "#EDE8DC",
              }}
            >
              เลือกเก็บในอุปกรณ์
            </div>
          </button>

          {/* Option 2: Supabase Cloud */}
          <button
            onClick={() => handleChoice("cloud")}
            className="flex flex-col justify-between p-4 text-left transition-all hover:-translate-y-0.5 active:translate-y-0 group cursor-pointer"
            style={{
              backgroundColor: "#F7F4EE",
              border: "2px solid #1A1208",
              boxShadow: "3px 3px 0px #1A1208",
            }}
          >
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: 24 }}>☁️</span>
                <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#3D6B5A" }}>CROSS-DEVICE SYNC</span>
              </div>
              <h4 style={{ fontFamily: "'Sarabun', sans-serif", fontSize: 15, fontWeight: 700, color: "#1A1208", marginBottom: 6 }}>
                ซิงก์บนคลาวด์ (Supabase)
              </h4>
              <p style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 12, color: "#1A120888", lineHeight: 1.5 }}>
                บันทึกประวัติการสนทนาบน Supabase แบบเข้ารหัส เพื่อซิงก์ประวัติระหว่าง Web App และ LINE Bot
              </p>
            </div>
            <div
              className="mt-4 py-2 text-center transition-colors group-hover:bg-[#3D6B5A] group-hover:text-white"
              style={{
                fontFamily: "'Sarabun', sans-serif",
                fontSize: 13,
                fontWeight: 700,
                color: "#1A1208",
                border: "1.5px solid #1A1208",
                backgroundColor: "#EDE8DC",
              }}
            >
              เลือกซิงก์บนคลาวด์
            </div>
          </button>
        </div>

        {/* Footer Note */}
        <p className="text-center" style={{ fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 11, color: "#1A120877" }}>
          💡 คุณสามารถลบประวัติย้อนหลังหรือส่งคำขอส่งออกข้อมูล (Export Data) ได้ตลอดเวลาที่หน้าการตั้งค่าความเป็นส่วนตัว
        </p>
      </div>
    </div>
  );
}
