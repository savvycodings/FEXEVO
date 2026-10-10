import { expect, test } from '@playwright/test'
import { ACCOUNTS, authStatePath } from './env'
import { openApp, openScreen } from './helpers'

test.use({ storageState: authStatePath('player') })

test.describe('progress, achievements, ranking, notifications', () => {
  test.beforeEach(async ({ page }) => openApp(page))

  test('progress overview loads ratings, activities and gamification state', async ({ page }) => {
    const b = await openScreen(page, 'Main', { screen: 'Progress', params: { screen: 'ProgressMain' } }, [
      '/api/auth/profile/rating-by-category',
      '/api/auth/profile/gamification/state',
    ])
    expect(b['/api/auth/profile/gamification/state']).toBeTruthy()
  })

  test('daily quests show the quest list from gamification state', async ({ page }) => {
    const b = await openScreen(page, 'Main', { screen: 'Progress', params: { screen: 'DailyQuest' } }, [
      '/api/auth/profile/gamification/state',
    ])
    expect(JSON.stringify(b['/api/auth/profile/gamification/state'])).toMatch(/quest/i)
  })

  test('achievements list and detail open', async ({ page }) => {
    await openScreen(page, 'Main', { screen: 'Progress', params: { screen: 'AllAchievements' } }, [])
    await openScreen(page, 'Main', { screen: 'Progress', params: { screen: 'AchievementDetail', params: { achievementKey: 'first-upload' } } }, [])
  })

  test('ranking loads the leaderboard', async ({ page }) => {
    const b = await openScreen(page, 'Main', { screen: 'Progress', params: { screen: 'Ranking' } }, [
      '/api/auth/profile/gamification/leaderboard',
    ])
    const board = JSON.stringify(b['/api/auth/profile/gamification/leaderboard'])
    expect(board).toContain('E2E Player')
    expect(ACCOUNTS.player).toBeTruthy()
  })

  test('notifications show the seeded notification', async ({ page }) => {
    await openScreen(page, 'Notifications', undefined, ['/api/auth/profile/notifications'])
    await expect(page.getByText('E2E welcome notification')).toBeVisible()
  })
})
