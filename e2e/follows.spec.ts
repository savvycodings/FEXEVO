import { expect, request, test, type Browser } from '@playwright/test'
import { API_URL, authStatePath, type Role } from './env'
import { T, nav, openApp } from './helpers'

/**
 * Follows and coach specialties: the coach sets specialties from the You tab; the player sees the
 * chips on the coach card, follows from the coach detail screen, still sees
 * Following after a reload, and the detail screen shows the follower count.
 */
const L = {
  en: { technique: 'Technique', matchplay: 'Matchplay', following: 'Following', followers: (n: number) => (n === 1 ? '1 follower' : `${n} followers`) },
  es: { technique: 'Técnica', matchplay: 'Juego de partido', following: 'Siguiendo', followers: (n: number) => (n === 1 ? '1 seguidor' : `${n} seguidores`) },
}

async function apiAs(role: Role, origin: string) {
  return request.newContext({ baseURL: API_URL, storageState: authStatePath(role), extraHTTPHeaders: { Origin: origin } })
}

async function pageAs(browser: Browser, role: Role, locale?: string) {
  const ctx = await browser.newContext({ storageState: authStatePath(role), ...(locale ? { locale } : {}) })
  const page = await ctx.newPage()
  await openApp(page)
  return { ctx, page }
}

async function openCoaches(page: import('@playwright/test').Page) {
  await nav(page, 'InviteSearch')
  await page.getByTestId(T.inviteSegment('coaches')).click()
}

test('follows: coach sets specialties, player follows from the coach page and sees the count', async ({ browser, baseURL }, info) => {
  const lang = info.project.name === 'es' ? 'es' : 'en'
  const l = L[lang]
  const origin = baseURL ?? 'http://localhost:8090'

  // Clean slate: no specialties, no follow.
  const coachApi = await apiAs('coach', origin)
  const playerApi = await apiAs('player', origin)
  const me = (await (await coachApi.get('/api/auth/get-session')).json()) as { user: { id: string } }
  const coachId = me.user.id
  expect((await coachApi.put('/api/auth/coach/specialties', { data: { specialties: [] } })).status()).toBe(200)
  const unfollowed = await playerApi.delete(`/api/auth/follows/coach/${coachId}`)
  expect(unfollowed.status()).toBe(200)
  // Other accounts may follow the seeded coach too; the player's follow adds one.
  const before = ((await unfollowed.json()) as { followerCount: number }).followerCount

  // Coach: You tab → Specialties → Edit → Matchplay + Technique → Save.
  const coach = await pageAs(browser, 'coach', info.project.use.locale)
  await nav(coach.page, 'Main', { screen: 'You', params: { screen: 'YouMain' } })
  const card = coach.page.getByTestId(T.coachSpecialtiesCard)
  await expect(card).toBeVisible()
  await coach.page.getByTestId(T.coachSpecialtiesEdit).click()
  await coach.page.getByTestId(T.specialtyChip('matchplay')).click()
  await coach.page.getByTestId(T.specialtyChip('technique')).click()
  const saved = coach.page.waitForResponse((r) => r.url().includes('/coach/specialties') && r.request().method() === 'PUT')
  await coach.page.getByTestId(T.specialtiesSave).click()
  const res = await saved
  expect(res.status()).toBe(200)
  expect(((await res.json()) as { specialties: string[] }).specialties).toEqual(['technique', 'matchplay'])
  await expect(card).toContainText(l.technique)
  await expect(card).toContainText(l.matchplay)
  await coach.ctx.close()

  // Player: the coach card shows the chips; Follow lives on the detail screen.
  const p = await pageAs(browser, 'player', info.project.use.locale)
  await openCoaches(p.page)
  const coachCard = p.page.getByTestId(T.coachCard(coachId))
  await expect(coachCard).toBeVisible()
  const chips = p.page.getByTestId(`${T.coachCard(coachId)}-chips`)
  await expect(chips).toContainText(l.technique)
  await expect(chips).toContainText(l.matchplay)
  await expect(p.page.getByTestId(T.followCoach(coachId))).toHaveCount(0)

  await coachCard.click()
  const followed = p.page.waitForResponse((r) => r.url().includes(`/follows/coach/${coachId}`) && r.request().method() === 'PUT')
  await p.page.getByTestId(T.coachDetailFollow).click()
  expect((await followed).status()).toBe(200)
  await expect(p.page.getByTestId(T.coachDetailFollow)).toContainText(l.following)
  await expect(p.page.getByTestId(T.coachFollowerCount)).toHaveText(String(before + 1))

  // Reload: still Following.
  await openApp(p.page)
  await openCoaches(p.page)
  await p.page.getByTestId(T.coachCard(coachId)).click()
  await expect(p.page.getByTestId(T.coachDetailFollow)).toContainText(l.following)
  await expect(p.page.getByTestId(T.coachFollowerCount)).toHaveText(String(before + 1))

  await Promise.all([p.ctx.close(), coachApi.dispose(), playerApi.dispose()])
})
