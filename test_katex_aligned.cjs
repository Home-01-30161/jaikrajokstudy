// Test MathText rendering of aligned environment
const katex = require('katex');

const testLatex = `
\\begin{aligned}
&\\text{โจทย์: หาผลบวกของจำนวนเต็มบวก } n \\text{ ที่ } 1 < n < 1000 \\text{ โดยที่ } n \\equiv 1 \\pmod{7}, n \\equiv 1 \\pmod{10}, n \\equiv 1 \\pmod{13}. \\\\
&\\text{ขั้นตอนแก้โจทย์:} \\\\
&1. \\text{หาค่า } \\text{LCM}(7, 10, 13) \\text{ เนื่องจาก } n \\equiv 1 \\pmod{7}, n \\equiv 1 \\pmod{10}, n \\equiv 1 \\pmod{13}: \\\\
&\\quad \\text{LCM}(7, 10, 13) = 7 \\times 10 \\times 13 = 910. \\\\
&2. \\text{แสดง } n \\text{ ในรูป } n = 910k + 1 \\text{ โดยที่ } k \\text{ เป็นจำนวนเต็มบวก}. \\\\
&3. \\text{กำหนดช่วง } 1 < n < 1000: \\\\
&\\quad 1 < 910k + 1 < 1000 \\implies 0 < 910k < 999 \\implies k < \\frac{999}{910} \\approx 1.0978. \\\\
&\\quad \\text{ดังนั้น } k = 1 \\text{ (เพียงค่าเดียวที่เป็นไปได้)}. \\\\
&4. \\text{คำนวณ } n = 910 \\times 1 + 1 = 911. \\\\
&5. \\text{ตรวจสอบว่า } 911 \\text{ อยู่ในช่วง } 1 < n < 1000 \\text{ และสอดคล้องกับเงื่อนไขทั้งหมด}: \\\\
&\\quad 911 \\div 7 = 130 \\text{ เศษ } 1, \\quad 911 \\div 10 = 91 \\text{ เศษ } 1, \\quad 911 \\div 13 = 70 \\text{ เศษ } 1. \\\\
&\\text{สรุป: ผลบวกของจำนวนเต็ม } n \\text{ ที่ตรงตามเงื่อนไขคือ } \\boxed{911}.
\\end{aligned}
`;

console.log("=== Testing KaTeX render of aligned ===");
try {
  const html = katex.renderToString(testLatex, {
    throwOnError: false,
    displayMode: true,
    trust: true,
    strict: false,
    output: "html",
  });
  console.log("SUCCESS - HTML length:", html.length);
  console.log("First 500 chars:", html.substring(0, 500));
} catch (e) {
  console.log("ERROR:", e.message);
}

// Test with $$ wrapper
console.log("\n=== Testing with $$ wrapper ===");
try {
  const html = katex.renderToString("$$" + testLatex + "$$", {
    throwOnError: false,
    displayMode: true,
    trust: true,
    strict: false,
    output: "html",
  });
  console.log("SUCCESS - HTML length:", html.length);
} catch (e) {
  console.log("ERROR:", e.message);
}

// Test simpler aligned
console.log("\n=== Testing simple aligned ===");
const simpleAligned = "\\begin{aligned} x &= 1 \\\\ y &= 2 \\end{aligned}";
try {
  const html = katex.renderToString(simpleAligned, {
    throwOnError: false,
    displayMode: true,
    trust: true,
    strict: false,
    output: "html",
  });
  console.log("SUCCESS");
} catch (e) {
  console.log("ERROR:", e.message);
}

// Test with $$ wrapper
try {
  const html = katex.renderToString("$$" + simpleAligned + "$$", {
    throwOnError: false,
    displayMode: true,
    trust: true,
    strict: false,
    output: "html",
  });
  console.log("SUCCESS with $$");
} catch (e) {
  console.log("ERROR with $$:", e.message);
}