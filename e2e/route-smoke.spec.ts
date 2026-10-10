import fs from 'fs'
import { expect, test, type Page } from '@playwright/test'
import { authStatePath, type Role } from './env'

/**
 * Opens every app route on the web as the role that can use it and records crashes
 * (uncaught page errors, or React's error screen). Writes test-results/route-smoke-report.json.
 */
type RouteCase = { name: string; role: Role; nav: [string, object?] }

const peer = { peerUserId: 'unknown', peerName: 'E2E Peer', peerLocation: '', actualScore: 0, lastScore: 0 }
const shot = { category: 'net_play', strokePreset: 'forehand_volley', labelKey: 'studentProfile.shots.forehandVolley' }
const tab = (tabName: string, screen?: string, params?: object): [string, object] => [
  'Main',
  screen ? { screen: tabName, params: { screen, params } } : { screen: tabName },
]

const ROUTES: RouteCase[] = [
  { name: 'AICoachMain', role: 'player', nav: tab('AICoach', 'AICoachMain') },
  { name: 'AICoach/StudentShotCategory', role: 'player', nav: tab('AICoach', 'StudentShotCategory', { flow: 'self-analyze' }) },
  { name: 'AICoach/StudentShotSelect', role: 'player', nav: tab('AICoach', 'StudentShotSelect', { flow: 'self-analyze', category: 'net_play' }) },
  { name: 'AICoach/StudentReviewTag', role: 'player', nav: tab('AICoach', 'StudentReviewTag', { flow: 'self-analyze', ...shot }) },
  { name: 'Activities', role: 'player', nav: tab('Activities') },
  { name: 'Playlist', role: 'coach', nav: tab('Playlist') },
  { name: 'MyCoachMain (player)', role: 'player', nav: tab('MyCoach', 'MyCoachMain') },
  { name: 'MyCoachMain (coach)', role: 'coach', nav: tab('MyCoach', 'MyCoachMain') },
  { name: 'StudentProfile', role: 'coach', nav: tab('MyCoach', 'StudentProfile', peer) },
  { name: 'MyCoach/StudentShotCategory', role: 'player', nav: tab('MyCoach', 'StudentShotCategory', { flow: 'coach-send' }) },
  { name: 'MyCoach/StudentShotSelect', role: 'player', nav: tab('MyCoach', 'StudentShotSelect', { flow: 'coach-send', category: 'net_play' }) },
  { name: 'MyCoach/StudentReviewTag', role: 'player', nav: tab('MyCoach', 'StudentReviewTag', { flow: 'coach-send', ...shot }) },
  { name: 'MyCoach/CoachStudentChat', role: 'coach', nav: tab('MyCoach', 'CoachStudentChat', peer) },
  { name: 'ProgressMain', role: 'player', nav: tab('Progress', 'ProgressMain') },
  { name: 'DailyQuest', role: 'player', nav: tab('Progress', 'DailyQuest') },
  { name: 'AllAchievements', role: 'player', nav: tab('Progress', 'AllAchievements') },
  { name: 'AchievementDetail', role: 'player', nav: tab('Progress', 'AchievementDetail', { achievementKey: 'streak-3' }) },
  { name: 'Ranking', role: 'player', nav: tab('Progress', 'Ranking') },
  {
    name: 'LeaderboardPlayer',
    role: 'player',
    nav: tab('Progress', 'LeaderboardPlayer', { userId: 'unknown', name: 'E2E', image: null, areaLocation: null, totalXp: 0, rank: 1, overallScore: null }),
  },
  { name: 'YouMain', role: 'player', nav: tab('You', 'YouMain') },
  { name: 'CoachProfileSectionEdit', role: 'coach', nav: tab('You', 'CoachProfileSectionEdit') },
  { name: 'InviteSearch', role: 'player', nav: ['InviteSearch'] },
  { name: 'ClubDetail', role: 'player', nav: ['ClubDetail', { clubId: 'e2e-missing-club' }] },
  { name: 'CoachDetail', role: 'player', nav: ['CoachDetail', { coachId: 'steve' }] },
  { name: 'CoachStudentChat (root)', role: 'player', nav: ['CoachStudentChat', { ...peer, peerRole: 'coach' }] },
  { name: 'AdminHub', role: 'admin', nav: ['AdminHub'] },
  { name: 'AdminTrain', role: 'admin', nav: ['AdminTrain'] },
  { name: 'AdminFalLora', role: 'admin', nav: ['AdminFalLora'] },
  { name: 'AdminAccuracy', role: 'admin', nav: ['AdminAccuracy'] },
  { name: 'AdminRetrievalBench', role: 'admin', nav: ['AdminRetrievalBench'] },
  { name: 'AdminMembers', role: 'admin', nav: ['AdminMembers', { filter: 'all' }] },
  { name: 'ProfileSettings', role: 'player', nav: ['ProfileSettings'] },
  { name: 'ProSubscription', role: 'player', nav: ['ProSubscription'] },
  { name: 'Notifications', role: 'player', nav: ['Notifications'] },
  { name: 'CoachAddPeople', role: 'coach', nav: ['CoachAddPeople'] },
  { name: 'CoachReviewEditor', role: 'coach', nav: ['CoachReviewEditor', { reviewId: 'e2e-missing' }] },
  { name: 'StudentCoachReview', role: 'player', nav: ['StudentCoachReview', { reviewId: 'e2e-missing' }] },
  { name: 'StudentSentVideo', role: 'player', nav: ['StudentSentVideo', { sentVideoId: 'e2e-missing' }] },
]

const CRASH_TEXT = /Something went wrong|Unexpected error|is not a function|Cannot read propert|undefined is not an object|Render Error/i

async function openApp(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => (globalThis as any).__xevoNav?.ready?.() === true, null, { timeout: 30_000 })
}

const REPORT = 'test-results/route-smoke-report.json'
const results: Array<{ route: string; role: Role; ok: boolean; errors: string[] }> = []

for (const role of ['player', 'coach', 'admin'] as Role[]) {
  test.describe(`routes as ${role}`, () => {
    test.use({ storageState: authStatePath(role) })
    for (const r of ROUTES.filter((x) => x.role === role)) {
      test(`route ${r.name}`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`))
        await openApp(page)
        await page.evaluate(([name, params]) => (globalThis as any).__xevoNav.navigate(name, params), r.nav)
        await page.waitForTimeout(2500)
        const body = await page.innerText('body')
        const crash = body.match(CRASH_TEXT)
        if (crash) errors.push(`screen: "${crash[0]}"`)
        results.push({ route: r.name, role, ok: errors.length === 0, errors })
        fs.writeFileSync(REPORT, JSON.stringify(results, null, 2))
        expect(errors, `${r.name} crashed`).toEqual([])
      })
    }
  })
}

