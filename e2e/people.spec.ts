import fs from 'fs'
import path from 'path'
import { expect, request, test, type Browser } from '@playwright/test'
import { ADMIN_GATE_PASSWORD, API_URL, FIXTURE_VIDEO, authStatePath, type Role } from './env'
import { T, nav, openApp, openScreen } from './helpers'

const WEB_ORIGIN = 'http://localhost:8090'
const apiAs = (role: Role, extra: Record<string, string> = {}) =>
  request.newContext({ baseURL: API_URL, storageState: authStatePath(role), extraHTTPHeaders: { Origin: WEB_ORIGIN, ...extra } })

async function pageAs(browser: Browser, role: Role) {
  const ctx = await browser.newContext({ storageState: authStatePath(role) })
  const page = await ctx.newPage()
  await openApp(page)
  return { ctx, page }
}

test('coach review round trip: player sends a video, coach reviews it, player sees the comment', async ({ browser }) => {
  test.setTimeout(150_000)
  // Player sends a clip to their coach (API; the upload UI is covered by technique.spec).
  const player = await apiAs('player')
  const up = await player.post('/api/auth/technique/upload', {
    multipart: {
      video: { name: 'e2e.mp4', mimeType: 'video/mp4', buffer: fs.readFileSync(path.resolve(FIXTURE_VIDEO)) },
      sendVideoToCoach: '1',
    },
  })
  expect(up.status(), await up.text()).toBe(200)

  // Coach finds the pending review.
  const coachApi = await apiAs('coach')
  const subs = (await (await coachApi.get('/api/auth/coach/submissions')).json()) as {
    submissions: Array<{ reviewId: string; status: string }>
  }
  const pending = subs.submissions.find((s) => s.status !== 'submitted' && s.status !== 'completed')
  expect(pending, JSON.stringify(subs)).toBeTruthy()
  const reviewId = pending!.reviewId

  // Coach writes a comment and submits in the UI.
  const comment = `E2E coach comment ${Date.now().toString(36)}`
  const coach = await pageAs(browser, 'coach')
  await nav(coach.page, 'CoachReviewEditor', { reviewId })
  await coach.page.getByTestId(T.coachReviewGood).fill(comment)
  await coach.page.getByTestId(T.coachReviewSendGood).click()
  const submitted = coach.page.waitForResponse((r) => r.url().includes(`/coach/review/${reviewId}/submit`))
  await coach.page.getByTestId(T.coachReviewSubmit).click()
  expect((await submitted).status()).toBe(200)

  // Player opens the review and sees the coach's comment.
  const p = await pageAs(browser, 'player')
  await nav(p.page, 'StudentCoachReview', { reviewId })
  await expect(p.page.getByText(comment)).toBeVisible({ timeout: 20_000 })

  await Promise.all([coach.ctx.close(), p.ctx.close(), player.dispose(), coachApi.dispose()])
})

test('clubs: a created and approved club shows in search and on its page', async ({ browser }) => {
  const name = `E2E Club ${Date.now().toString(36)}`
  const coachApi = await apiAs('coach')
  const created = await coachApi.post('/api/auth/club', { data: { name, address: 'Calle 1 #2-3', city: 'Bogotá', country: 'CO' } })
  expect(created.status(), await created.text()).toBeLessThan(300)
  const club = (await created.json()) as { id?: string; club?: { id: string; slug: string } }
  const id = club.club?.id ?? club.id!
  const admin = await apiAs('admin', { 'X-Xevo-Admin-Hub-Password': ADMIN_GATE_PASSWORD })
  const approved = await admin.post(`/api/auth/club/admin/${id}/approve`)
  expect(approved.status(), await approved.text()).toBeLessThan(300)
  const list = (await (await coachApi.get('/api/auth/club')).json()) as { clubs?: Array<{ name: string; slug: string }> } | Array<{ name: string; slug: string }>
  const clubs = Array.isArray(list) ? list : list.clubs ?? []
  const slug = clubs.find((c) => c.name === name)?.slug
  expect(slug, JSON.stringify(list).slice(0, 300)).toBeTruthy()

  const { ctx, page } = await pageAs(browser, 'player')
  await openScreen(page, 'ClubDetail', { clubId: slug }, [`/api/auth/club/${slug}`])
  await expect(page.getByText(name).first()).toBeVisible()
  await openScreen(page, 'InviteSearch', undefined, ['/api/auth/club'])
  await Promise.all([ctx.close(), coachApi.dispose(), admin.dispose()])
})

test('profile settings: edit the first name and save', async ({ browser }) => {
  const { ctx, page } = await pageAs(browser, 'admin')
  await openScreen(page, 'ProfileSettings', undefined, ['/api/auth/profile/me'])
  await page.getByTestId(T.settingsSection('personal')).click()
  const first = `E2E${Date.now().toString(36).slice(-4)}`
  await page.getByTestId(T.settingsFirstName).fill(first)
  const saved = page.waitForResponse((r) => r.url().includes('/profile/basic') && r.request().method() === 'POST')
  await page.getByTestId(T.settingsSave).first().click()
  expect((await saved).status()).toBeLessThan(300)
  const me = await page.request.get(`${API_URL}/api/auth/profile/me`)
  expect(JSON.stringify(await me.json())).toContain(first)
  await ctx.close()
})

test('admin hub: unlock with the gate password and open members', async ({ browser }) => {
  const { ctx, page } = await pageAs(browser, 'admin')
  await nav(page, 'AdminHub')
  await page.getByTestId(T.adminGatePassword).fill(ADMIN_GATE_PASSWORD)
  await page.getByTestId(T.adminGateUnlock).click()
  await expect(page.getByTestId(T.adminMembers)).toBeVisible()
  const members = page.waitForResponse((r) => r.url().includes('/profile/directory') && r.request().method() === 'GET')
  await page.getByTestId(T.adminMembers).click()
  const res = await members
  expect(res.status()).toBeLessThan(300)
  // The members list includes the seeded coach.
  expect(JSON.stringify(await res.json())).toContain('E2E Coach')
  await ctx.close()
})
