import { test, expect, type Browser } from '@playwright/test'
import { T, openApp, nav } from './helpers'
import { authStatePath } from './env'

async function pageAs(browser: Browser) {
  const ctx = await browser.newContext({ storageState: authStatePath('admin') })
  const page = await ctx.newPage()
  await openApp(page)
  return { ctx, page }
}

test('training accuracy: a shot match tile explains how its score was built', async ({ browser }, info) => {
  const { ctx, page } = await pageAs(browser)
  await nav(page, 'AdminAccuracy')
  const tile = page.locator('[data-testid^="bench-submission-"]').first()
  await expect(tile).toBeVisible({ timeout: 30_000 })
  await tile.click()

  const panel = page.getByTestId(T.scoreBreakdown)
  await expect(panel).toBeVisible({ timeout: 30_000 })
  await expect(panel).toContainText('How this score was built')
  for (const step of [2, 3, 4]) await page.getByTestId(T.scoreBreakdownStep(step)).click()
  await expect(panel).toContainText('Average of the three')
  await expect(panel).toContainText('Boost = 1 + merit × 11')
  await expect(panel).toContainText('Final = average after boost')
  await panel.screenshot({ path: info.outputPath('score-breakdown.png') })
  await ctx.close()
})
