import { expect, request, type Page } from '@playwright/test'
import { API_URL } from './env'

/** Same names as src/lib/testIds.ts (kept in sync by hand; the app file has RN imports). */
export const T = {
  welcomeNext: 'welcome-next',
  welcomeFreeTrial: 'welcome-free-trial',
  welcomeLogin: 'welcome-login',
  signupName: 'signup-name',
  signupEmail: 'signup-email',
  signupPassword: 'signup-password',
  signupRepeat: 'signup-repeat',
  signupCountry: 'signup-country',
  signupSubmit: 'signup-submit',
  countrySearch: 'country-search',
  countryOption: (code: string) => `country-option-${code}`,
  signinEmail: 'signin-email',
  signinPassword: 'signin-password',
  signinSubmit: 'signin-submit',
  signinForgot: 'signin-forgot',
  otpDigit: (i: number) => `otp-digit-${i}`,
  verifySubmit: 'verify-submit',
  accountCreatedDone: 'account-created-done',
  resetEmail: 'reset-email',
  resetCode: 'reset-code',
  resetPassword: 'reset-password',
  resetRepeat: 'reset-repeat',
  resetSubmit: 'reset-submit',
  setupName: 'setup-name',
  setupUsername: 'setup-username',
  setupGender: (g: string) => `setup-gender-${g}`,
  setupHand: (h: string) => `setup-hand-${h}`,
  setupCourt: (c: string) => `setup-court-${c}`,
  setupHeight: 'setup-height',
  setupWeight: 'setup-weight',
  setupStep1Next: 'setup-step1-next',
  setupRankingNo: 'setup-ranking-no',
  setupRankingNext: 'setup-ranking-next',
  setupLevel: (l: string) => `setup-level-${l}`,
  setupFinish: 'setup-finish',
  // Technique flow
  techniqueChooseFile: 'technique-choose-file',
  howToAccept: 'how-to-accept',
  shotCategory: (key: string) => `shot-category-${key}`,
  shotOption: (preset: string) => `shot-option-${preset}`,
  techniqueAnalyse: 'technique-analyse',
  techniqueScore: 'technique-score',
  magicShotGenerate: 'magic-shot-generate',
  magicShotResult: 'magic-shot-result',
  // Profile settings
  settingsSection: (key: string) => `settings-section-${key}`,
  settingsFirstName: 'settings-first-name',
  settingsSave: 'settings-save',
  // Admin hub
  adminGatePassword: 'admin-gate-password',
  adminGateUnlock: 'admin-gate-unlock',
  adminMembers: 'admin-members',
  benchSubmission: (analysisId: string) => `bench-submission-${analysisId}`,
  scoreBreakdown: 'score-breakdown',
  scoreBreakdownStep: (n: number) => `score-breakdown-step-${n}`,
  // Coach review
  coachReviewGood: 'coach-review-good',
  coachReviewBad: 'coach-review-bad',
  coachReviewSubmit: 'coach-review-submit',
  coachReviewSendGood: 'coach-review-send-good',
  coachReviewSendBad: 'coach-review-send-bad',
  // Tabs
  tab: (name: string) => `tab-${name}`,
  viewAngle: (id: string) => `view-angle-${id}`,
  viewAngleConfirm: 'view-angle-confirm',
  setClipContinue: 'set-clip-continue',
}

/** Open the app signed in (storage state) and wait until navigation is ready. */
const seenApi = new WeakMap<Page, Array<{ path: string; status: number; body: Promise<any> }>>()

/** Record every API response from app start (screens may reuse data fetched earlier). */
function recordApi(page: Page) {
  if (seenApi.has(page)) return
  const list: Array<{ path: string; status: number; body: Promise<any> }> = []
  seenApi.set(page, list)
  page.on('response', (r) => {
    if (r.request().method() !== 'GET' || !r.url().includes('/api/auth/')) return
    list.push({ path: new URL(r.url()).pathname, status: r.status(), body: r.json().catch(() => null) })
  })
}

export async function openApp(page: Page) {
  recordApi(page)
  await page.goto('/')
  await page.waitForFunction(() => (globalThis as any).__xevoNav?.ready?.() === true, null, { timeout: 45_000 })
}

export async function nav(page: Page, name: string, params?: object) {
  await page.evaluate(([n, p]) => (globalThis as any).__xevoNav.navigate(n, p), [name, params] as const)
}

/** Latest 6-digit code emailed to `to` (fake Resend outbox). */
export async function emailedCode(to: string, since = 0): Promise<string> {
  const api = await request.newContext({ baseURL: API_URL })
  try {
    for (let i = 0; i < 30; i++) {
      const r = await api.get(`/__e2e/outbox?to=${encodeURIComponent(to)}`)
      const { emails } = (await r.json()) as { emails: Array<{ at: string; text?: string; html?: string }> }
      const fresh = emails.filter((e) => Date.parse(e.at) >= since)
      const last = fresh[fresh.length - 1]
      const m = last && `${last.text ?? ''} ${last.html ?? ''}`.match(/\b(\d{6})\b/)
      if (m) return m[1]!
      await new Promise((r2) => setTimeout(r2, 500))
    }
  } finally {
    await api.dispose()
  }
  throw new Error(`no code emailed to ${to}`)
}

export async function typeCode(page: Page, code: string) {
  await page.getByTestId(T.otpDigit(0)).click()
  await page.keyboard.type(code, { delay: 40 })
}

/** Walk the welcome slides to the last one (Free Trial / Login). */
export async function finishWelcome(page: Page) {
  for (let i = 0; i < 5; i++) {
    const next = page.getByTestId(T.welcomeNext)
    if (!(await next.isVisible().catch(() => false))) break
    await next.click()
    await page.waitForTimeout(300)
  }
  await expect(page.getByTestId(T.welcomeLogin)).toBeVisible()
}

export function uniqueEmail(label: string) {
  return `e2e-${label}-${Date.now().toString(36)}@xevo.test`
}

/**
 * Navigate to a screen and require each listed API path to answer 2xx, with no uncaught
 * page errors. Returns the parsed JSON bodies by path.
 */
export async function openScreen(page: Page, name: string, params: object | undefined, apiPaths: string[]) {
  recordApi(page)
  const errors: string[] = []
  const onErr = (e: Error) => errors.push(e.message)
  page.on('pageerror', onErr)
  await nav(page, name, params)
  const bodies: Record<string, any> = {}
  for (const p of apiPaths) {
    // Latest response for the path, whether the screen fetched it now or the app fetched it earlier.
    await expect.poll(() => (seenApi.get(page) ?? []).some((x) => x.path === p), { message: `${p} was requested`, timeout: 30_000 }).toBe(true)
    const last = [...(seenApi.get(page) ?? [])].reverse().find((x) => x.path === p)!
    expect(last.status, `${p} status`).toBeLessThan(300)
    bodies[p] = await last.body
  }
  await page.waitForTimeout(800)
  page.off('pageerror', onErr)
  expect(errors, `${name} page errors`).toEqual([])
  return bodies
}

/** From the AI Coach home: Choose File → how-to → upload the fixture clip → Net Play / Forehand volley / Front → analyse. */
export async function uploadAndAnalyze(page: Page, fixturePath: string): Promise<string> {
  await nav(page, 'Main', { screen: 'AICoach', params: { screen: 'AICoachMain' } })
  await page.getByTestId(T.techniqueChooseFile).click()
  // Accepting the how-to opens the file picker directly; the shot is declared after upload.
  const chooser = page.waitForEvent('filechooser')
  await page.getByTestId(T.howToAccept).click()
  await (await chooser).setFiles(fixturePath)
  await page.getByTestId(T.shotCategory('net_play')).click()
  await page.getByTestId(T.shotOption('forehand_volley')).click()
  await page.getByTestId(T.viewAngle('front')).click()
  await page.getByTestId(T.viewAngleConfirm).click()
  await page.getByTestId(T.setClipContinue).click()
  const analyzed = page.waitForResponse((r) => r.url().includes('/technique/analyze') && r.request().method() === 'POST', { timeout: 90_000 })
  await page.getByTestId(T.techniqueAnalyse).click()
  const res = await analyzed
  expect(res.status()).toBe(200)
  const { analysisId } = (await res.json()) as { analysisId: string }
  await expect(page.getByTestId(T.techniqueScore)).toHaveText(/\d+/, { timeout: 30_000 })
  return analysisId
}
