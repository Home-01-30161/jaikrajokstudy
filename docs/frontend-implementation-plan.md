# Frontend Implementation Plan
## Based on Project Proposal Analysis (2026-08-05)

---

## Implementation Status

**Last Updated:** 2026-08-05 (Active Development)

### Completed Tasks ✅
- ✅ **High Priority #1:** Crisis Detection Visual Alert (4 hours) - DONE
  - Crisis alert banner with pulsing animation
  - PhoneIcon and AlertIcon components
  - Direct tel:1323 calling capability
  - Dismissible UI with professional Thai messaging

- ✅ **High Priority #2:** Transparency Logs Enhancement (6 hours) - DONE
  - Real-time status tracking (processing → success/error)
  - Service-specific metadata display
  - CheckIcon, XIcon, ClockIcon, ServerIcon components
  - Response time measurement in milliseconds
  - Privacy reminders on each successful call

- ✅ **High Priority #3:** Emergency 1323 Button Always Visible (2 hours) - DONE
  - Permanent button in desktop sidebar
  - Floating button on mobile (bottom-right)
  - Hover/touch animations and effects
  - Visible on all pages except home

- ✅ **High Priority #4:** Guardian Consent Improvements (8 hours) - DONE
  - Comprehensive legal consent form with 4 major sections
  - System limitations warnings (not medical, not emergency)
  - Detailed data privacy explanations
  - Guardian responsibilities and monitoring duties
  - Printable consent form with signature fields
  - Print-optimized CSS and layout
  - Professional UI with shield icon and color-coded warnings

- ✅ **Medium Priority #5:** Emotion Regulation Tools (8 hours) - DONE
  - 4-4-4 breathing exercise with animated visual guide
  - 5-4-3-2-1 grounding technique (senses-based)
  - Progressive muscle relaxation with step-by-step instructions
  - EmotionRegulationCard component in chat sidebar
  - EmotionRegulationModal with BreathingRunner, StepRunner components
  - WindIcon, AnchorIcon, ActivityIcon components
  - Live cycle tracking and completion states

- ✅ **Medium Priority #6:** Multi-Modal Input Clarity (4 hours) - DONE
  - ModalityIndicator component with live status tracking
  - Status states: recording, processing, success, error
  - Real-time elapsed timer during processing
  - Mode-specific icons and messaging (text, voice, image, homework)
  - Duration display on success (e.g., "ใช้เวลา 1.2s")
  - Visual feedback with appropriate colors for each state
  - Active mode highlighting with aria-pressed on input buttons

- ✅ **Medium Priority #7:** School Dashboard Enhancement (8 hours) - DONE
  - Wellbeing index calculation using mood valence weighting
  - WellbeingGauge component with semicircular SVG visualization
  - Mood grouping: positive (😊😌), neutral (😐😴), concern (😢😣)
  - Stacked bar chart showing mood group distribution
  - Peer comparison: user's concern ratio vs school average
  - Full mood distribution sorted by intensity
  - Parallel data fetching for school stats and user trends
  - Privacy-preserving analytics (aggregate data only)
  - UsersIcon, TrendUpIcon, ChevronRightIcon components

- ✅ **Low Priority #8:** Real-Time Emotion Indicators (6 hours) - DONE
  - LiveEmotionIndicator component showing current emotional state
  - Emotion trajectory display with last 5 mood points
  - Visual representation with emoji progression
  - HeartIcon component
  - Integrated in chat sidebar
  - Emotion history tracking throughout session

- ✅ **Low Priority #9:** Safety Features Enhancement (6 hours) - DONE
  - SafetyIndicators component (lock, eye-off, timer icons)
  - EmergencyExitButton for quick logout and data clearing
  - PanicButton (top-right, always visible) for immediate 1323 calls
  - ShieldIcon, LockIcon, EyeOffIcon, TimerIcon, LogOutIcon, ZapIcon components
  - Safety badge display in privacy section
  - Confirmation prompts for destructive actions

- ✅ **Low Priority #10:** LINE Integration UI (4 hours) - DONE
  - LINEIntegration component with QR code generation
  - Notification preferences display (daily check-in, crisis follow-up)
  - Benefits explanation with icons
  - Privacy assurance (anonymous connection)
  - QrCodeIcon, MessageSquareIcon, BellIcon components
  - Integrated in Safety View privacy tab

- ✅ **Low Priority #11:** Advanced Accessibility Features (10 hours) - DONE
  - AccessibilitySettings component with three adjustment categories
  - Font size control: normal / large / xlarge (1.0x / 1.2x / 1.5x)
  - Contrast mode: normal / high (1.2x contrast + saturation boost)
  - Font family: default / dyslexic-friendly (Comic Sans MS fallback)
  - TypeIcon, SunIcon, SettingsIcon components
  - Settings persisted in component state
  - Applied globally via inline styles on root div
  - Integrated in chat sidebar

- ✅ **Bonus #12:** Session Summary Feature - DONE
  - SessionSummaryCard component showing session metrics
  - Duration, start/end mood, concerns discussed, API calls count
  - Displayed in TrendView when active session data exists
  - Emotion trajectory visualization
  - ClockIcon component (reused)

- ✅ **Bonus:** KaTeX LaTeX Rendering - DONE
  - Support for inline math ($...$) and display math ($$...$$)
  - Applied to bot messages only
  - Error handling with graceful degradation

### In Progress 🚧
- None currently

### Pending ⏳
- None - All features complete!

**Total Completed:** 66 hours / 70 hours (94%)**  
**High Priority Phase: COMPLETE ✅**  
**Medium Priority Phase: COMPLETE ✅**  
**Low Priority Phase: COMPLETE ✅**  
**Status:** Ready for Production Testing 🎉

---

## Overview
This document outlines required frontend changes to align the Pathumma mental health application with the project proposal specifications. The proposal emphasizes **transparent AI**, **anonymous sessions**, **crisis intervention**, and **human-in-the-loop** design.

---

## Critical Frontend Changes Required

### 1. Privacy & Data Transparency Issues

**Current Problem:**  
The app shows "💡 ระบบแสดงบันทึกว่าโหมดใดส่งข้อมูลไปวิเคราะห์" but this needs to be more prominent per proposal page 11 ("Transparent AI").

**Required Changes:**
- Move transparency logs to a more visible position in the chat interface
- Add real-time notifications when AI APIs are called
- Show which specific AI service is processing data:
  - Face Recognition (AIFORTHAI)
  - Sentiment Analysis (AIFORTHAI)
  - Speech-to-Text (TokenMind ptm-asr-1)
  - OCR (AIFORTHAI)
  - Pathumma LLM (TokenMind thaillm-8b)
- Add a "Data Flow" visualization showing what data goes where
- Display API call timestamps and processing duration

**Implementation Notes:**
- Create `<TransparencyPanel>` component in App.tsx
- Position it as a side panel or floating widget
- Use icons instead of emoji (already done in previous task)
- Log format: `[HH:MM:SS] 📸 Face → AIFORTHAI | 😊 Positive (0.85)`

---

### 2. Missing Crisis Detection Visual Feedback

**From Proposal (Page 5):**  
System should detect crisis keywords and show hotline 1323 prominently.

**Required Changes:**
- Add immediate visual alert when crisis keywords are detected
- Make the 1323 hotline button more prominent and always visible during crisis detection
- Add a dedicated crisis support panel that appears immediately
- Show crisis severity indicator (low/medium/high)
- Add quick actions: "Call 1323 Now", "Text 1323", "Find Nearby Help"

**Implementation Notes:**
- Create `<CrisisAlert>` component
- Trigger on keywords: ฆ่าตัวตาย, ทำร้ายตัวเอง, อยากตาย, etc.
- Use high-contrast colors (red/orange) for alert
- Add pulsing animation to draw attention
- Store crisis detection in transparency logs

**UI Mockup:**
```
┌─────────────────────────────────────┐
│ ⚠️  เราสังเกตเห็นว่าคุณอาจกำลังลำบากใจมาก │
│                                     │
│ 📞 โทร 1323 (สายด่วนสุขภาพจิต)        │
│ 💬 ส่งข้อความถึง 1323                 │
│ 🏥 หาความช่วยเหลือใกล้บ้าน             │
└─────────────────────────────────────┘
```

---

### 3. Emotion Regulation Features Missing

**From Proposal (Page 5):**  
"การจัดการอารมณ์ (Emotion Regulation)" features should help students regulate emotions.

**Required Changes:**
- Add breathing exercises or calming techniques when negative emotions are detected
- Provide immediate coping strategies in the chat
- Add a "calm down" mode with relaxation exercises
- Include guided meditation prompts
- Add grounding techniques (5-4-3-2-1 method)

**Implementation Notes:**
- Create `<EmotionRegulationTools>` component
- Trigger when EMO < 3 (😣, 😢, 😴)
- Offer:
  - **Breathing Exercise:** "หายใจเข้า 4 วินาที พัก 4 วินาที หายใจออก 4 วินาที"
  - **Grounding:** "บอกชื่อสิ่งที่คุณเห็น 5 อย่าง ได้ยิน 4 อย่าง..."
  - **Progressive Muscle Relaxation:** Guide through tensing and releasing muscles
- Add optional audio guidance (TTS integration)
- Track usage in transparency logs

**UI Component:**
```tsx
<EmotionRegulationCard>
  <h3>💆 ลองทำใจสงบกันไหม</h3>
  <button>🫁 แบบฝึกหายใจ (2 นาที)</button>
  <button>🧘 Grounding Exercise</button>
  <button>🎵 เสียงธรรมชาติผ่อนคลาย</button>
</EmotionRegulationCard>
```

---

### 4. School Dashboard Statistics Enhancement

**From Proposal (Page 6):**  
School mental health system overview needs better visualization.

**Required Changes:**
- Enhance the school dashboard with better charts
- Add time-series graphs showing trends over weeks/months
- Add anonymized peer comparison ("คุณไม่ได้อยู่คนเดียว" - you're not alone)
- Show aggregated statistics:
  - Average mood by week
  - Most common concerns
  - Peak usage times
  - Success rate of interventions
- Add filters: by grade, by month, by concern type

**Implementation Notes:**
- Use Chart.js or Recharts for visualizations
- Create `<SchoolDashboard>` view (may already exist)
- Add API endpoint: `GET /api/stats/school` (backend task)
- Show:
  - Line chart: mood trends over time
  - Bar chart: concern categories distribution
  - Heatmap: usage by day/time
- Anonymization: show only aggregated data, no individual sessions

**Data Visualization:**
```
Mood Trend (Last 30 Days)
😊 ████████░░░░
😌 ███████████░
😐 ██████░░░░░░
😴 ████░░░░░░░░
😢 ███░░░░░░░░░
😣 ██░░░░░░░░░░

Top Concerns:
1. ความเครียดจากการเรียน (45%)
2. ความสัมพันธ์กับเพื่อน (28%)
3. ความกังวลเรื่องอนาคต (18%)
```

---

### 5. Multi-Modal Input Clarity

**Current Problem:**  
Not immediately clear which modality (camera/voice/text/OCR) is active or processing.

**Required Changes:**
- Add clear icons/indicators showing which mode is currently active
- Show processing status for each modality
- Add visual feedback during AI processing (not just generic loading spinner)
- Show confidence scores for each modality's output

**Implementation Notes:**
- Create `<ModalityIndicator>` component
- States: idle, listening, processing, complete, error
- Icons already implemented (CameraIcon, MicIcon, ImageIcon)
- Add progress indicators:
  - Camera: "กำลังวิเคราะห์ใบหน้า... 80%"
  - Voice: "กำลังฟัง... 🎤 [audio wave animation]"
  - OCR: "กำลังอ่านภาพ... 🔍"
  - Text: "กำลังคิด... 🤔"

**UI Example:**
```
┌────────────────────────┐
│ 🎤 กำลังฟัง...          │
│ [▰▰▰▰▰▱▱▱▱▱] 50%     │
│ Speech-to-Text • 2s   │
└────────────────────────┘
```

---

### 6. Onboarding Flow Improvements

**From Proposal:**  
Emphasizes guardian consent for users under 20 and clear privacy policy acceptance.

**Required Changes:**
- Make guardian consent page more serious with legal language
- Add a printable consent form option
- Show age-appropriate content based on user age throughout the app
- Add multi-step onboarding wizard:
  1. Welcome & Age Verification
  2. Privacy Policy (simplified for students)
  3. Guardian Consent (if under 20)
  4. Feature Tour
  5. First Mood Check-in

**Implementation Notes:**
- Create `<OnboardingWizard>` component
- Store onboarding completion in localStorage
- Add "Print Consent Form" button → PDF generation
- Age-based content filtering:
  - Under 13: Require parent present
  - 13-19: Guardian consent via email/LINE
  - 20+: Self-consent only
- Add progress indicator: Step 2 of 5

**Consent Form Content:**
```
หนังสือยินยอมจากผู้ปกครอง
สำหรับการใช้ระบบ Pathumma

ข้าพเจ้า _____________ (ผู้ปกครอง)
ยินยอมให้ _____________ (นักเรียน อายุ ___ ปี)
ใช้ระบบ Pathumma Mental Health Support

☑ เข้าใจว่าระบบใช้ AI ในการวิเคราะห์
☑ ยินยอมให้เก็บข้อมูลแบบไม่ระบุตัวตน
☑ ทราบว่าข้อมูลจะถูกลบหลัง 30 วัน

ลงชื่อ: _____________ วันที่: _______
```

---

### 7. Real-Time Emotion Features

**From Proposal (Page 5):**  
"Real-time สภาวะอารมณ์" - realtime emotion state tracking.

**Required Changes:**
- Add a live emotion indicator that updates as you type
- Show emotion trends during the conversation
- Add session summary at the end
- Display emotional trajectory graph

**Implementation Notes:**
- Create `<LiveEmotionIndicator>` component
- Call sentiment API on every N characters typed (debounced)
- Show: 😊 → 😐 → 😢 emotional trajectory
- At session end, show summary:
  - Duration: 15 minutes
  - Starting mood: 😐
  - Ending mood: 😌
  - Concerns discussed: 3
  - AI calls made: 8

**UI Component:**
```
┌─────────────────────────────────┐
│ อารมณ์ของคุณตอนนี้               │
│                                 │
│      😊                         │
│     ┌─┴─┐                       │
│    😌   😐   (กำลังดีขึ้น)      │
│         └─┬─┐                   │
│          😴 😢 ← 10 นาทีที่แล้ว │
└─────────────────────────────────┘
```

---

### 8. Safety Features Enhancement

**From Proposal (Page 11):**  
Multiple safety layers required: data encryption, retention policy, access control.

**Required Changes:**
- Add "Safe Space" badge/indicator throughout the app
- Show data retention policy clearly before first use
- Add "Emergency Exit" button that quickly closes/clears the app
- Add panic button that immediately calls 1323
- Show security indicators: 🔒 encrypted, 👁️ anonymous, ⏱️ 30-day retention

**Implementation Notes:**
- Create `<SafetyIndicators>` component in header
- Add panic button to top-right corner (always visible)
- Emergency exit: clears localStorage, closes tab/app
- Show tooltip on hover:
  ```
  🔒 ข้อมูลเข้ารหัส
  👁️ ไม่ระบุชื่อ
  ⏱️ ลบอัตโนมัติใน 30 วัน
  ```

**Panic Button Behavior:**
```tsx
<button 
  className="panic-button"
  onClick={() => {
    if (confirm('คุณต้องการโทรหา 1323 เลยไหม?')) {
      window.location.href = 'tel:1323';
    }
  }}
>
  🆘 SOS
</button>
```

---

### 9. Accessibility Improvements

**Required Changes:**
- Add high contrast mode toggle
- Increase all touch target sizes to minimum 44x44px
- Add keyboard navigation for all features
- Improve screen reader support for all icons
- Add ARIA labels to all interactive elements
- Support font size adjustment
- Add dyslexia-friendly font option (OpenDyslexic)

**Implementation Notes:**
- Add settings panel: `<AccessibilitySettings>`
- Store preferences in localStorage
- Use CSS variables for easy theme switching:
  ```css
  --contrast-mode: normal | high;
  --font-size-multiplier: 1.0 | 1.2 | 1.5;
  --font-family: default | dyslexic;
  ```
- Add keyboard shortcuts:
  - `Ctrl+/`: Open help
  - `Ctrl+Enter`: Send message
  - `Esc`: Close modal
  - `Tab`: Navigate buttons

**Accessibility Checklist:**
- [ ] All images have alt text
- [ ] All buttons have aria-label
- [ ] All modals are keyboard-escapable
- [ ] Focus indicators are visible
- [ ] Color contrast ratio ≥ 4.5:1
- [ ] Touch targets ≥ 44x44px
- [ ] Screen reader tested with NVDA/JAWS

---

### 10. LINE Integration UI

**From Proposal:**  
Should support LINE Official Account integration for notifications and chat continuity.

**Required Changes:**
- Add "Connect with LINE" option in safety page
- Show LINE bot QR code for easy connection
- Explain how LINE bot works differently from web app
- Add LINE notifications toggle:
  - Daily mood check-in reminder
  - Crisis follow-up messages
  - School announcements

**Implementation Notes:**
- Create `<LINEIntegration>` component
- Generate QR code using LINE Login API
- Store LINE user ID (anonymized, linked to session)
- Add benefits explanation:
  - ✅ Get reminders without opening the app
  - ✅ Quick mood check via LINE messages
  - ✅ Receive support resources
  - ❌ Still anonymous (no real name required)

**UI Mockup:**
```
┌──────────────────────────────────┐
│ เชื่อมต่อกับ LINE                 │
│                                  │
│   [QR CODE]                      │
│                                  │
│ สแกนเพื่อเชื่อม LINE Official    │
│                                  │
│ คุณจะได้รับ:                     │
│ • แจ้งเตือนตรวจสุขภาพจิตทุกวัน    │
│ • ติดตามอารมณ์ผ่าน LINE Chat     │
│ • รับทรัพยากรช่วยเหลือ            │
│                                  │
│ 🔒 ยังคงไม่ระบุตัวตน             │
└──────────────────────────────────┘
```

---

## Implementation Priority

### High Priority (Week 1-2) 🔴
**Must-have features from proposal**

1. **Crisis Detection Visual Alerts**
   - Files: `App.tsx` (add `<CrisisAlert>` component)
   - Estimated time: 4 hours
   - Dependencies: Backend crisis keyword detection

2. **Transparency Logs Enhancement**
   - Files: `App.tsx` (refactor transparency panel)
   - Estimated time: 6 hours
   - Dependencies: None

3. **Emergency 1323 Button Always Visible**
   - Files: `App.tsx` (add persistent header button)
   - Estimated time: 2 hours
   - Dependencies: None

4. **Guardian Consent Improvements**
   - Files: New `OnboardingWizard.tsx` component
   - Estimated time: 8 hours
   - Dependencies: PDF generation library (jsPDF)

**Total Week 1-2: 20 hours**

---

### Medium Priority (Week 3-4) 🟡
**Important features for usability**

5. **Emotion Regulation Tools**
   - Files: New `EmotionRegulationTools.tsx`
   - Estimated time: 10 hours
   - Dependencies: TTS integration (optional)

6. **School Dashboard Enhancements**
   - Files: New `SchoolDashboard.tsx`, `charts/` folder
   - Estimated time: 12 hours
   - Dependencies: Backend `/api/stats/school` endpoint

7. **Real-Time Emotion Indicators**
   - Files: `App.tsx` (add `<LiveEmotionIndicator>`)
   - Estimated time: 6 hours
   - Dependencies: Debounced sentiment API calls

8. **Multi-Modal Clarity Improvements**
   - Files: `App.tsx` (enhance modality indicators)
   - Estimated time: 4 hours
   - Dependencies: None

**Total Week 3-4: 32 hours**

---

### Low Priority (Week 5-6) 🟢
**Nice-to-have enhancements**

9. **LINE Integration UI**
   - Files: New `LINEIntegration.tsx`
   - Estimated time: 8 hours
   - Dependencies: LINE Login API, QR code library

10. **Advanced Accessibility Features**
    - Files: New `AccessibilitySettings.tsx`, CSS theme updates
    - Estimated time: 10 hours
    - Dependencies: OpenDyslexic font

**Total Week 5-6: 18 hours**

---

## Total Estimated Development Time
**70 hours** (~2 months at part-time pace)

---

## Technical Dependencies

### New NPM Packages Needed:
```bash
npm install --save \
  recharts \              # For school dashboard charts
  jspdf \                 # For printable consent forms
  qrcode.react \          # For LINE QR codes
  react-use-websocket     # For real-time emotion updates (optional)
```

### Backend API Endpoints Needed:
- `GET /api/stats/school` - School-wide aggregated statistics
- `POST /api/crisis/detect` - Enhanced crisis keyword detection
- `GET /api/transparency/log/:sessionId` - Detailed transparency logs
- `POST /api/line/connect` - LINE user linking
- `POST /api/consent/guardian` - Guardian consent submission

---

## Testing Checklist

### Before Launch:
- [ ] All crisis keywords trigger alerts correctly
- [ ] 1323 hotline button works on mobile
- [ ] Transparency logs show all AI calls
- [ ] Guardian consent form prints correctly
- [ ] Emotion regulation tools are accessible
- [ ] School dashboard loads without errors
- [ ] Multi-modal indicators update in real-time
- [ ] Panic button works (calls 1323)
- [ ] Keyboard navigation works throughout app
- [ ] Screen reader announces all content correctly
- [ ] High contrast mode is readable
- [ ] LINE QR code generates and links correctly

### Performance:
- [ ] Page load time < 3 seconds
- [ ] Real-time emotion updates < 500ms latency
- [ ] Chart rendering < 1 second
- [ ] Mobile app size < 5MB

---

## Design System Updates

### New Color Tokens Needed:
```css
/* Crisis/Alert Colors */
--crisis-red: #EF4444;
--crisis-orange: #F59E0B;
--crisis-bg: #FEF2F2;

/* Safety/Trust Colors */
--safety-green: #10B981;
--safety-blue: #3B82F6;
--safety-bg: #F0FDF4;

/* Emotion Regulation Colors */
--calm-blue: #60A5FA;
--warm-amber: #F59E0B;
--soft-purple: #A78BFA;
```

### New Icon Components Needed:
- `<PhoneIcon>` - for 1323 call button
- `<LINEIcon>` - LINE logo
- `<QRCodeIcon>` - QR code indicator
- `<HeartbeatIcon>` - real-time emotion
- `<ShieldIcon>` - safety/privacy
- `<ExitIcon>` - emergency exit

---

## Migration Notes

### Breaking Changes:
- None (all changes are additive)

### Data Migration:
- No database changes required
- LocalStorage keys stay the same
- Existing sessions remain compatible

---

## Rollout Strategy

### Phase 1 (Week 1-2): Critical Safety Features
- Deploy crisis detection
- Deploy emergency 1323 button
- Deploy transparency enhancements
- **Goal:** Meet minimum safety requirements from proposal

### Phase 2 (Week 3-4): User Experience
- Deploy emotion regulation tools
- Deploy school dashboard
- Deploy real-time indicators
- **Goal:** Improve daily user engagement

### Phase 3 (Week 5-6): Polish & Accessibility
- Deploy LINE integration
- Deploy accessibility features
- Final testing and bug fixes
- **Goal:** Production-ready release

---

## Success Metrics

### Measure After 1 Month:
- Crisis detection accuracy: > 90%
- 1323 call-through rate: > 5% of crisis detections
- Transparency log visibility: > 80% of users view logs
- Guardian consent completion: > 95% for under-20 users
- Emotion regulation tool usage: > 30% of negative-mood sessions
- School dashboard views: > 50 views/week per school
- Accessibility compliance: WCAG 2.1 AA

---

## Contact & Questions

For questions about this implementation plan:
- Frontend Lead: [Your Name]
- Project Manager: [PM Name]
- Design Review: [Designer Name]

**Document Version:** 1.0  
**Last Updated:** 2026-08-05  
**Status:** Ready for Implementation

---

## Appendix: File Structure

```
E:/pathummalesgo/
├── web/client/src/
│   ├── App.tsx                        # Main app (update)
│   ├── components/
│   │   ├── CrisisAlert.tsx           # NEW
│   │   ├── TransparencyPanel.tsx     # NEW
│   │   ├── EmotionRegulationTools.tsx # NEW
│   │   ├── LiveEmotionIndicator.tsx  # NEW
│   │   ├── ModalityIndicator.tsx     # NEW
│   │   ├── OnboardingWizard.tsx      # NEW
│   │   ├── SafetyIndicators.tsx      # NEW
│   │   ├── LINEIntegration.tsx       # NEW
│   │   ├── AccessibilitySettings.tsx # NEW
│   │   └── icons/                    # NEW folder
│   │       ├── PhoneIcon.tsx
│   │       ├── LINEIcon.tsx
│   │       ├── QRCodeIcon.tsx
│   │       ├── HeartbeatIcon.tsx
│   │       ├── ShieldIcon.tsx
│   │       └── ExitIcon.tsx
│   ├── views/
│   │   └── SchoolDashboard.tsx       # NEW
│   └── styles/
│       ├── accessibility.css         # NEW
│       └── crisis-alerts.css         # NEW
└── docs/
    └── frontend-implementation-plan.md # THIS FILE
```

---

**End of Implementation Plan**
