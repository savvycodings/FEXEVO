import { expect, request, test } from '@playwright/test'
import { ACCOUNTS, API_URL, PASSWORD } from './env'
import { T, emailedCode, finishWelcome, typeCode, uniqueEmail } from './helpers'

test.describe('onboarding and auth', () => {
  test('welcome slides lead to Free Trial and Login, in the configured language', async ({ page }, info) => {
    await page.goto('/')
    await finishWelcome(page)
    await expect(page.getByTestId(T.welcomeFreeTrial)).toBeVisible()
    const login = await page.getByTestId(T.welcomeLogin).innerText()
    if (info.project.name === 'es') expect(login).not.toMatch(/^Login$/)
    else expect(login).toMatch(/Login/)
  })

  test('sign in with the seeded player, stay signed in after reload', async ({ page }) => {
    await page.goto('/')
    await finishWelcome(page)
    await page.getByTestId(T.welcomeLogin).click()
    await page.getByTestId(T.signinEmail).fill(ACCOUNTS.player)
    await page.getByTestId(T.signinPassword).fill(PASSWORD)
    await page.getByTestId(T.signinSubmit).click()
    await page.waitForFunction(() => (globalThis as any).__xevoNav?.ready?.() === true, null, { timeout: 45_000 })
    await page.reload()
    await page.waitForFunction(() => (globalThis as any).__xevoNav?.ready?.() === true, null, { timeout: 45_000 })
  })

  test('sign up with an emailed code, then profile setup reaches the home tabs', async ({ page }) => {
    const email = uniqueEmail('signup')
    const t0 = Date.now() - 1000
    await page.goto('/')
    await finishWelcome(page)
    await page.getByTestId(T.welcomeFreeTrial).click()
    await page.getByTestId(T.signupName).fill('E2E Signup')
    await page.getByTestId(T.signupEmail).fill(email)
    await page.getByTestId(T.signupPassword).fill(PASSWORD)
    await page.getByTestId(T.signupRepeat).fill(PASSWORD)
    await page.getByTestId(T.signupCountry).click()
    await page.getByTestId(T.countrySearch).fill('Colombia')
    await page.getByTestId(T.countryOption('CO')).click()
    await page.getByTestId(T.signupSubmit).click()

    await expect(page.getByTestId(T.otpDigit(0))).toBeVisible()
    await typeCode(page, await emailedCode(email, t0))
    await page.getByTestId(T.verifySubmit).click()
    await page.getByTestId(T.accountCreatedDone).click()

    // Profile setup
    await expect(page.getByTestId(T.setupHand('right'))).toBeVisible({ timeout: 30_000 })
    const username = page.getByTestId(T.setupUsername)
    if (await username.count()) await username.fill(`e2e_${Date.now().toString(36)}`)
    const gender = page.locator('[data-testid^="setup-gender-"]')
    if (await gender.count()) await gender.first().click()
    await page.getByTestId(T.setupHand('right')).click()
    await page.getByTestId(T.setupCourt('right')).click()
    await page.getByTestId(T.setupHeight).fill('180')
    await page.getByTestId(T.setupWeight).fill('75')
    await page.getByTestId(T.setupStep1Next).click()
    await page.getByTestId(T.setupRankingNo).click()
    await page.getByTestId(T.setupRankingNext).click()
    await page.locator('[data-testid^="setup-level-"]').first().click()
    await page.getByTestId(T.setupFinish).click()
    await page.waitForFunction(() => (globalThis as any).__xevoNav?.ready?.() === true, null, { timeout: 45_000 })
  })

  test('password reset with an emailed code, then sign in with the new password', async ({ page }) => {
    // A fresh account so the seeded ones keep their password.
    const email = uniqueEmail('reset')
    // Separate request context: page.request would share (and set) the browser's session cookie.
    const api = await request.newContext({ baseURL: API_URL, extraHTTPHeaders: { Origin: 'http://localhost:8090' } })
    await api.post('/api/auth/sign-up/email', { data: { email, password: PASSWORD, name: 'E2E Reset' } })
    const newPassword = 'E2E-new-password-2!'
    const t0 = Date.now() - 1000

    await page.goto('/')
    await finishWelcome(page)
    await page.getByTestId(T.welcomeLogin).click()
    await page.getByTestId(T.signinForgot).click()
    await page.getByTestId(T.resetEmail).fill(email)
    await page.getByTestId(T.resetSubmit).click()
    await page.getByTestId(T.resetCode).fill(await emailedCode(email, t0))
    await page.getByTestId(T.resetPassword).fill(newPassword)
    await page.getByTestId(T.resetRepeat).fill(newPassword)
    await page.getByTestId(T.resetSubmit).click()

    await expect(async () => {
      const res = await api.post('/api/auth/sign-in/email', { data: { email, password: newPassword } })
      expect(res.ok()).toBe(true)
    }).toPass({ timeout: 15_000 })
    await api.dispose()
  })
})
