import fs from 'fs'
import path from 'path'
import { expect, request, test, type Browser } from '@playwright/test'
import { ACCOUNTS, ADMIN_GATE_PASSWORD, API_URL, FIXTURE_VIDEO, authStatePath, type Role } from './env'
import { T, nav, openApp, openScreen } from './helpers'

const WEB_ORIGIN = `http://localhost:${process.env.E2E_WEB_PORT ?? 8090}`
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

test('friend requests: B sends from the profile, A accepts from the detail screen, B shows in My Friends', async ({ browser }) => {
  test.setTimeout(120_000)
  const seed = await request.newContext({ baseURL: API_URL })
  const { accounts } = (await (await seed.post('/__e2e/seed')).json()) as {
    accounts: Record<Role, { id: string }>
  }
  await seed.dispose()
  const playerId = accounts.player.id
  const adminId = accounts.admin.id

  // Start clean: no friendship or pending request between admin (B) and player (A).
  const adminApi = await apiAs('admin')
  const before = (await (await adminApi.get(`/api/auth/friends/relationship/${playerId}`)).json()) as {
    status: string
    requestId?: string
  }
  if (before.status === 'friends') await adminApi.delete(`/api/auth/friends/${playerId}`)
  if (before.status === 'outgoing_pending') await adminApi.delete(`/api/auth/friends/requests/${before.requestId}`)
  if (before.status === 'incoming_pending') await adminApi.post(`/api/auth/friends/requests/${before.requestId}/decline`)
  // ...and no other pending requests to A, so the count starts at 1.
  const playerApi = await apiAs('player')
  const incoming = (await (await playerApi.get('/api/auth/friends/requests/incoming')).json()) as { requests: Array<{ id: string }> }
  for (const r of incoming.requests) await playerApi.post(`/api/auth/friends/requests/${r.id}/decline`)
  await playerApi.dispose()

  // B opens A's profile and taps Add friend.
  const b = await pageAs(browser, 'admin')
  await nav(b.page, 'Main', {
    screen: 'Progress',
    params: {
      screen: 'LeaderboardPlayer',
      params: { userId: playerId, name: 'E2E Player', image: null, areaLocation: null, totalXp: 0, rank: 1, overallScore: null },
    },
  })
  const sent = b.page.waitForResponse((r) => r.url().includes('/friends/requests') && r.request().method() === 'POST')
  await b.page.getByTestId('friend-action-none').click()
  expect((await sent).status()).toBeLessThan(300)
  await expect(b.page.getByTestId('friend-action-outgoing_pending')).toBeVisible()
  const rel = (await (await adminApi.get(`/api/auth/friends/relationship/${playerId}`)).json()) as { requestId: string }
  const requestId = rel.requestId

  // A sees it under Requests with a count of 1.
  const a = await pageAs(browser, 'player')
  await openScreen(a.page, 'InviteSearch', undefined, ['/api/auth/friends/requests/incoming'])
  await expect(a.page.getByTestId('friends-requests-tab-badge')).toHaveText('1')
  await a.page.getByTestId('friends-requests-tab').click()
  await expect(a.page.getByTestId('friend-requests-count')).toHaveText('1')
  await expect(a.page.getByTestId(`friend-request-${requestId}`)).toContainText(/Admin/)

  // Opens the detail and accepts.
  await a.page.getByTestId(`friend-request-open-${requestId}`).click()
  await expect(a.page.getByTestId('friend-request-detail')).toContainText(/Admin/)
  const accepted = a.page.waitForResponse((r) => r.url().includes(`/friends/requests/${requestId}/accept`))
  await a.page.getByTestId('friend-request-detail-accept').click()
  expect((await accepted).status()).toBe(200)

  // Back on Requests, the card shows Accepted.
  await expect(a.page.getByTestId(`friend-request-accepted-${requestId}`)).toBeVisible()
  await expect(a.page.getByTestId('recent-requests')).toContainText(/Admin/)

  // B appears in My Friends (the settings spec may have renamed the admin's first name).
  await a.page.getByText(/^My Friends$/).click()
  await expect(a.page.getByText(/E2E\S* Admin/).first()).toBeVisible()

  const after = (await (await adminApi.get(`/api/auth/friends/relationship/${playerId}`)).json()) as { status: string }
  expect(after.status).toBe('friends')
  expect(adminId).toBeTruthy()
  await Promise.all([a.ctx.close(), b.ctx.close(), adminApi.dispose()])
})

/** A fresh club owned by the coach, approved by the admin. */
async function approvedClub(label: string) {
  const name = `E2E ${label} ${Date.now().toString(36)}`
  const owner = await apiAs('coach')
  const created = await owner.post('/api/auth/club', { data: { name, address: '1 Ocean Dr', city: 'Miami', country: 'USA' } })
  expect(created.status(), await created.text()).toBe(201)
  const club = ((await created.json()) as { club: { id: string; slug: string } }).club
  const admin = await apiAs('admin', { 'X-Xevo-Admin-Hub-Password': ADMIN_GATE_PASSWORD })
  expect((await admin.post(`/api/auth/club/admin/${club.id}/approve`)).status()).toBe(200)
  await admin.dispose()
  return { ...club, name, owner }
}

test('club requests: a club invites the player, who accepts from Friends › Requests', async ({ browser }) => {
  test.setTimeout(120_000)
  // Start clean: no other pending club invites for the player.
  const playerApi = await apiAs('player')
  const pending = (await (await playerApi.get('/api/auth/club-memberships/invites')).json()) as { invites: Array<{ id: string }> }
  for (const inv of pending.invites) await playerApi.post(`/api/auth/club-memberships/invites/${inv.id}/decline`)
  const friendReqs = (await (await playerApi.get('/api/auth/friends/requests/incoming')).json()) as { count: number }

  const club = await approvedClub('Invite Club')
  const invited = await club.owner.post(`/api/auth/club/mine/${club.id}/invites`, { data: { email: ACCOUNTS.player } })
  expect(invited.status(), await invited.text()).toBe(201)
  const inviteId = ((await invited.json()) as { membership: { id: string } }).membership.id

  const p = await pageAs(browser, 'player')
  await openScreen(p.page, 'InviteSearch', undefined, ['/api/auth/club-memberships/invites'])
  // The Requests badge counts friend requests and club invites.
  await expect(p.page.getByTestId('friends-requests-tab-badge')).toHaveText(String(friendReqs.count + 1))
  await p.page.getByTestId('friends-requests-tab').click()
  await expect(p.page.getByTestId('club-requests-count')).toHaveText('1')
  const card = p.page.getByTestId(`club-request-${inviteId}`)
  await expect(card).toContainText(club.name)
  await expect(card).toContainText('Miami, USA')
  await expect(p.page.getByTestId(`club-request-members-${inviteId}`)).toHaveText('0 members')

  const accepted = p.page.waitForResponse((r) => r.url().includes(`/club-memberships/invites/${inviteId}/accept`))
  await p.page.getByTestId(`club-request-accept-${inviteId}`).click()
  expect((await accepted).status()).toBe(200)
  await expect(p.page.getByTestId(`club-request-accepted-${inviteId}`)).toBeVisible()
  await expect(p.page.getByTestId(`club-request-members-${inviteId}`)).toHaveText('1 member')
  await expect(p.page.getByTestId('club-requests-count')).toHaveCount(0)

  // Tapping the card body opens the club, where the player is now a member.
  await p.page.getByTestId(`club-request-open-${inviteId}`).click()
  await expect(p.page.getByTestId('club-membership-member')).toBeVisible()
  await expect(p.page.getByTestId('club-detail-members')).toHaveText('1 member')

  await Promise.all([p.ctx.close(), playerApi.dispose(), club.owner.dispose()])
})

test('club page: the player asks to join, the owner approves, the page shows Member, then the player leaves', async ({ browser }) => {
  test.setTimeout(120_000)
  const club = await approvedClub('Join Club')
  const p = await pageAs(browser, 'player')
  await openScreen(p.page, 'ClubDetail', { clubId: club.slug }, [`/api/auth/club/${club.slug}`])
  await expect(p.page.getByTestId('club-detail-members')).toHaveText('0 members')

  const asked = p.page.waitForResponse((r) => r.url().includes('/club-memberships/requests') && r.request().method() === 'POST')
  await p.page.getByTestId('club-membership-none').click()
  expect((await asked).status()).toBe(201)
  await expect(p.page.getByTestId('club-membership-requested')).toBeVisible()

  // The owner approves the request (portal action, done through the API here).
  const members = (await (await club.owner.get(`/api/auth/club/mine/${club.id}/members`)).json()) as {
    requests: Array<{ id: string }>
  }
  expect(members.requests).toHaveLength(1)
  const approved = await club.owner.post(`/api/auth/club/mine/${club.id}/requests/${members.requests[0]!.id}/approve`)
  expect(approved.status(), await approved.text()).toBe(200)

  // Reload the page: Member, with the count up by one.
  await p.page.reload()
  await p.page.waitForFunction(() => (globalThis as any).__xevoNav?.ready?.() === true, null, { timeout: 45_000 })
  await openScreen(p.page, 'ClubDetail', { clubId: club.slug }, [`/api/auth/club/${club.slug}`])
  await expect(p.page.getByTestId('club-membership-member')).toBeVisible()
  await expect(p.page.getByTestId('club-detail-members')).toHaveText('1 member')

  // Leave club (with confirmation) returns to Join club.
  await p.page.getByTestId('club-membership-member').click()
  await p.page.getByTestId('club-membership-leave').click()
  const left = p.page.waitForResponse((r) => r.url().includes(`/club-memberships/clubs/${club.id}`) && r.request().method() === 'DELETE')
  await p.page.getByTestId('club-membership-leave-confirm').click()
  expect((await left).status()).toBe(200)
  await expect(p.page.getByTestId('club-membership-none')).toBeVisible()
  await expect(p.page.getByTestId('club-detail-members')).toHaveText('0 members')

  await Promise.all([p.ctx.close(), club.owner.dispose()])
})

test('friends ranking: Ranking stays in Friends; World, Country and the country page', async ({ browser }) => {
  test.setTimeout(120_000)
  const p = await pageAs(browser, 'player')
  await openScreen(p.page, 'InviteSearch', undefined, ['/api/auth/friends/requests/incoming'])
  const players = p.page.waitForResponse((r) => r.url().includes('/profile/gamification/ranking/players'))
  await p.page.getByTestId('friends-ranking-tab').click()
  expect((await players).status()).toBe(200)

  // Still on the People screen (not Progress › Ranking), World selected, rows or the empty message.
  await expect(p.page.getByTestId('ranking-view')).toBeVisible()
  await expect(p.page.getByTestId(T.inviteSegment('friends'))).toBeVisible()
  await expect(p.page.getByTestId('ranking-scope-world')).toHaveAttribute('aria-selected', 'true')
  await expect(p.page.locator('[data-testid^="ranking-row-player-"], [data-testid="ranking-empty"]').first()).toBeVisible()

  // Country: the filter is disabled; a country row opens its page.
  const countries = p.page.waitForResponse((r) => r.url().includes('/profile/gamification/ranking/countries'))
  await p.page.getByTestId('ranking-scope-country').click()
  expect((await countries).status()).toBe(200)
  await expect(p.page.getByTestId('ranking-filter')).toHaveAttribute('aria-disabled', 'true')
  const row = p.page.locator('[data-testid^="ranking-row-country-"]').first()
  await expect(row.or(p.page.getByTestId('ranking-empty'))).toBeVisible()
  if (await row.isVisible()) {
    await row.click()
    await expect(p.page.getByTestId('country-stats')).toBeVisible()
    for (const tab of ['players', 'clubs', 'about']) await expect(p.page.getByTestId(`country-tab-${tab}`)).toBeVisible()
    await p.page.getByTestId('country-back').click()
    await expect(p.page.getByTestId('ranking-scope-country')).toHaveAttribute('aria-selected', 'true')
  }
  await p.ctx.close()
})

test('friends ranking: a player with no club sees the no-club state and its button opens Clubs', async ({ browser }) => {
  test.setTimeout(120_000)
  // Leave every club, so the player has no main club.
  const playerApi = await apiAs('player')
  const mine = (await (await playerApi.get('/api/auth/club-memberships/mine')).json()) as { clubs: Array<{ id: string }> }
  for (const c of mine.clubs) expect((await playerApi.delete(`/api/auth/club-memberships/clubs/${c.id}`)).status()).toBe(200)
  await playerApi.dispose()

  const p = await pageAs(browser, 'player')
  await openScreen(p.page, 'InviteSearch', undefined, ['/api/auth/friends/requests/incoming'])
  await p.page.getByTestId('friends-ranking-tab').click()
  const club = p.page.waitForResponse((r) => r.url().includes('/ranking/players?scope=club'))
  await p.page.getByTestId('ranking-scope-club').click()
  expect((await club).status()).toBe(200)
  await expect(p.page.getByTestId('ranking-no-club')).toBeVisible()
  await p.page.getByTestId('ranking-no-club-button').click()
  await expect(p.page.getByTestId('ranking-view')).toHaveCount(0)
  // The Clubs segment is shown: the Friends sub-tabs are gone.
  await expect(p.page.getByTestId('friends-ranking-tab')).toHaveCount(0)
  await expect(p.page.getByTestId(T.inviteSegment('clubs'))).toBeVisible()
  await p.ctx.close()
})
