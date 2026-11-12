import { expect, test } from '@playwright/test'
import { API_URL, authStatePath } from './env'
import { T, openApp, openScreen } from './helpers'

/**
 * Profile Edit → Game Settings: the player details step (hand, court side, height, weight with
 * per-device units) saves through /profile/player-details before the level step opens.
 */
test('game settings: switch court side, enter weight in lb, set level, values persist', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: authStatePath('player') })
  const page = await ctx.newPage()
  await openApp(page)

  const openGameSettings = async () => {
    await openScreen(page, 'ProfileSettings', undefined, ['/api/auth/profile/me'])
    await page.getByTestId('profile-hub-tab-settings').click()
    await page.getByTestId(T.settingsSection('game')).click()
    await expect(page.getByTestId(T.settingsSetLevel)).toBeVisible()
  }
  await openGameSettings()

  // Pick whichever court side isn't saved yet, so the spec doesn't depend on seed values.
  const before = (await (await page.request.get(`${API_URL}/api/auth/profile/me`)).json()).profile
  const side = before?.courtSide === 'left' ? 'right' : 'left'
  await page.getByTestId(T.settingsCourt(side)).click()
  await expect(page.getByTestId(T.settingsCourt(side))).toHaveAttribute('aria-checked', 'true')

  await page.getByTestId(T.settingsUnit('weight')).click()
  await page.getByTestId(T.settingsUnitOption('lb')).click()
  await page.getByTestId(T.settingsWeight).fill('187')

  const saved = page.waitForResponse((r) => r.url().includes('/profile/player-details') && r.request().method() === 'POST')
  await page.getByTestId(T.settingsSetLevel).click()
  expect((await saved).status()).toBe(200)
  await expect(page.getByTestId(T.settingsLevelStep)).toBeVisible()

  const after = (await (await page.request.get(`${API_URL}/api/auth/profile/me`)).json()).profile
  expect(after.courtSide).toBe(side)
  expect(after.weightKg).toBe(84.8)

  // Leave and come back: the step resets to player details, the side is kept and the unit
  // choice (lb, per device) shows 187 lb again.
  await page.reload()
  await openApp(page)
  await openGameSettings()
  await expect(page.getByTestId(T.settingsCourt(side))).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId(T.settingsUnit('weight'))).toContainText('lb')
  await expect(page.getByTestId(T.settingsWeight)).toHaveValue('187')
  await ctx.close()
})

test('game settings: out-of-range height shows the range and sends nothing', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: authStatePath('player') })
  const page = await ctx.newPage()
  await openApp(page)
  await openScreen(page, 'ProfileSettings', undefined, ['/api/auth/profile/me'])
  await page.getByTestId('profile-hub-tab-settings').click()
  await page.getByTestId(T.settingsSection('game')).click()

  const posts: string[] = []
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/profile/player-details')) posts.push(r.url())
  })
  await page.getByTestId(T.settingsHeight).fill('90')
  await page.getByTestId(T.settingsSetLevel).click()
  await expect(page.getByTestId(T.settingsDetailsError)).toContainText('100')
  await expect(page.getByTestId(T.settingsDetailsError)).toContainText('250')
  await expect(page.getByTestId(T.settingsSetLevel)).toBeVisible()
  expect(posts).toEqual([])
  await ctx.close()
})
