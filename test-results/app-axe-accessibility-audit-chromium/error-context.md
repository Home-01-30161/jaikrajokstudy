# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> axe accessibility audit
- Location: tests\app.spec.ts:36:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "https://jaikrajokstudy.vercel.app/", waiting until "load"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - region "Notifications alt+T"
  - generic [ref=e5]:
    - paragraph [ref=e9]: Side A — บันทึกความรู้สึก
    - generic [ref=e11]:
      - generic [ref=e12]: A1
      - paragraph [ref=e14]: เข้าสู่ระบบ
      - heading "JaiKraJok" [level=1] [ref=e15]
      - tablist [ref=e17]:
        - tab "เข้าสู่ระบบ" [selected] [ref=e18] [cursor=pointer]
        - tab "สมัครสมาชิก" [ref=e19] [cursor=pointer]
      - generic [ref=e20]: อีเมล
      - textbox "อีเมล" [ref=e21]:
        - /placeholder: example@gmail.com
      - generic [ref=e22]:
        - generic [ref=e23]: รหัสผ่าน
        - button "ลืมรหัสผ่าน?" [ref=e24] [cursor=pointer]
      - textbox "รหัสผ่าน" [ref=e25]:
        - /placeholder: อย่างน้อย 4 ตัวอักษร
      - button "เข้าสู่ระบบ" [ref=e26] [cursor=pointer]
      - button "เข้าสู่ระบบด้วย Google" [ref=e27] [cursor=pointer]
      - paragraph [ref=e33]: พื้นที่นี้เป็นของคุณคนเดียว — ไม่มีใครเห็นสิ่งที่คุณเขียน
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | import AxeBuilder from '@axe-core/playwright'
  3  | 
  4  | test('homepage returns 200', async ({ page }) => {
  5  |   const response = await page.goto('https://jaikrajokstudy.vercel.app/')
  6  |   expect(response?.status()).toBe(200)
  7  | })
  8  | 
  9  | test('page has title', async ({ page }) => {
  10 |   await page.goto('https://jaikrajokstudy.vercel.app/')
  11 |   const title = await page.title()
  12 |   console.log('Title:', title)
  13 |   expect(title.length).toBeGreaterThan(0)
  14 | })
  15 | 
  16 | test('body is visible and not blank', async ({ page }) => {
  17 |   await page.goto('https://jaikrajokstudy.vercel.app/')
  18 |   await page.waitForLoadState('domcontentloaded')
  19 |   await expect(page.locator('body')).toBeVisible()
  20 |   const text = await page.locator('body').innerText()
  21 |   expect(text.trim().length).toBeGreaterThan(0)
  22 | })
  23 | 
  24 | test('no broken images (404)', async ({ page }) => {
  25 |   const broken: string[] = []
  26 |   page.on('response', r => {
  27 |     if (r.request().resourceType() === 'image' && r.status() === 404)
  28 |       broken.push(r.url())
  29 |   })
  30 |   await page.goto('https://jaikrajokstudy.vercel.app/')
  31 |   await page.waitForLoadState('networkidle')
  32 |   console.log('Broken images:', broken)
  33 |   expect(broken.length).toBe(0)
  34 | })
  35 | 
  36 | test('axe accessibility audit', async ({ page }) => {
> 37 |   await page.goto('https://jaikrajokstudy.vercel.app/')
     |              ^ Error: page.goto: Test timeout of 30000ms exceeded.
  38 |   await page.waitForLoadState('domcontentloaded')
  39 |   const results = await new AxeBuilder({ page }).analyze()
  40 |   const violations = results.violations
  41 |   console.log('Total violations:', violations.length)
  42 |   violations.forEach(v =>
  43 |     console.log(`[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`)
  44 |   )
  45 |   // Report all — don't fail hard so we get the full list
  46 |   expect(violations.filter(v => v.impact === 'critical').length).toBe(0)
  47 | })
  48 | 
```