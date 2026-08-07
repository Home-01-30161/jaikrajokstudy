import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('homepage returns 200', async ({ page }) => {
  const response = await page.goto('https://jaikrajokstudy.vercel.app/')
  expect(response?.status()).toBe(200)
})

test('page has title', async ({ page }) => {
  await page.goto('https://jaikrajokstudy.vercel.app/')
  const title = await page.title()
  console.log('Title:', title)
  expect(title.length).toBeGreaterThan(0)
})

test('body is visible and not blank', async ({ page }) => {
  await page.goto('https://jaikrajokstudy.vercel.app/')
  await page.waitForLoadState('domcontentloaded')
  await expect(page.locator('body')).toBeVisible()
  const text = await page.locator('body').innerText()
  expect(text.trim().length).toBeGreaterThan(0)
})

test('no broken images (404)', async ({ page }) => {
  const broken: string[] = []
  page.on('response', r => {
    if (r.request().resourceType() === 'image' && r.status() === 404)
      broken.push(r.url())
  })
  await page.goto('https://jaikrajokstudy.vercel.app/')
  await page.waitForLoadState('networkidle')
  console.log('Broken images:', broken)
  expect(broken.length).toBe(0)
})

test('axe accessibility audit', async ({ page }) => {
  await page.goto('https://jaikrajokstudy.vercel.app/')
  await page.waitForLoadState('domcontentloaded')
  const results = await new AxeBuilder({ page }).analyze()
  const violations = results.violations
  console.log('Total violations:', violations.length)
  violations.forEach(v =>
    console.log(`[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`)
  )
  // Report all — don't fail hard so we get the full list
  expect(violations.filter(v => v.impact === 'critical').length).toBe(0)
})
