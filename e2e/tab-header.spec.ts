import { expect, test } from '@playwright/test'
import { authStatePath } from './env'
import { openApp } from './helpers'

// A stacked screen (Friends) jumps tabs through its tab bar with navigate("Main", { screen }).
// The shared header must still show the profile and PRO badge there, and the logo only on AI Coach.

const LABEL = { Progress: 'Progress', Activities: 'Activities', You: 'You' } as const

for (const tab of Object.keys(LABEL) as Array<keyof typeof LABEL>) {
  test(`tab bar on Friends → ${tab} keeps the profile header`, async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authStatePath('player') })
    const page = await ctx.newPage()
    await openApp(page)
    await page.getByTestId('tab-You').click()
    await page.getByLabel('Open invite').click()
    await expect(page.getByText('My Friends', { exact: true }).first()).toBeVisible()
    await page.getByText(LABEL[tab], { exact: true }).locator('visible=true').last().click()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `test-results/tab-header-${tab}.png` })
    await expect(page.getByLabel('Open Pro subscription').locator('visible=true')).toHaveCount(1)
    await expect(page.getByLabel(tab === 'You' ? 'Open invite' : 'Open profile').locator('visible=true')).toHaveCount(1)
    await ctx.close()
  })
}

test('AI Coach home keeps the logo, before and after visiting other tabs', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: authStatePath('player') })
  const page = await ctx.newPage()
  await openApp(page)
  const logo = page.getByLabel('Xevo', { exact: true }).locator('visible=true')
  await page.getByTestId('tab-AICoach').click()
  await expect(logo).toHaveCount(1)
  await page.getByTestId('tab-Progress').click()
  await expect(logo).toHaveCount(0)
  await page.getByTestId('tab-AICoach').click()
  await expect(logo).toHaveCount(1)
  await ctx.close()
})
