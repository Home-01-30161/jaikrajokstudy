import { test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('contrast details', async ({ page }) => {
  await page.goto('https://jaikrajokstudy.vercel.app/')
  await page.waitForLoadState('networkidle')
  const results = await new AxeBuilder({ page }).analyze()
  results.violations.forEach(v => {
    console.log(`\n[${v.impact}] ${v.id}: ${v.description}`)
    v.nodes.forEach(n => {
      console.log('  selector:', n.target.join(' '))
      console.log('  html:', n.html?.slice(0, 120))
      if (n.any?.[0]?.data) console.log('  data:', JSON.stringify(n.any[0].data))
    })
  })
})
