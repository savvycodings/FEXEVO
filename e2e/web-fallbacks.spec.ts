import { expect, test } from '@playwright/test'
import { authStatePath } from './env'

/** Web fallbacks for native-only modules: screens using them open cleanly, thumbnails work. */
test.describe('web fallbacks', () => {
  test.use({ storageState: authStatePath('coach') })

  test('screens using thumbnails / screenshots open without console errors', async ({ page }) => {
    const problems: string[] = []
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
    page.on('console', (m) => {
      // Missing-record API calls (404) from placeholder ids are expected here.
      if (m.type() === 'error' && !/status of 404|Failed to load resource/.test(m.text())) problems.push(m.text())
    })
    await page.goto('/')
    await page.waitForFunction(() => (globalThis as any).__xevoNav?.ready?.() === true)
    for (const nav of [
      ['Main', { screen: 'AICoach', params: { screen: 'AICoachMain' } }],
      ['Main', { screen: 'Activities' }],
      ['CoachReviewEditor', { reviewId: 'e2e-missing' }],
    ] as const) {
      await page.evaluate(([n, p]) => (globalThis as any).__xevoNav.navigate(n, p), nav)
      await page.waitForTimeout(2000)
    }
    expect(problems).toEqual([])
  })

  test('web thumbnail returns a real frame of a video', async ({ page }) => {
    // VP9 copy of the fixture clip: bundled Chromium can't decode H.264.
    await page.route('**/e2e-clip.webm', (r) => r.fulfill({ path: 'e2e/fixtures/clip-vp9.webm', contentType: 'video/webm' }))
    await page.goto('/')
    // Same steps as src/lib/videoThumbnails.web.ts (attached, hidden <video> → canvas).
    const r = await page.evaluate(async () => {
      const v = document.createElement('video')
      v.muted = true
      v.preload = 'auto'
      Object.assign(v.style, { position: 'fixed', left: '-10000px', width: '1px', height: '1px', opacity: '0' })
      document.body.appendChild(v)
      const loaded = new Promise((ok, no) => { v.onloadedmetadata = ok; v.onerror = no })
      v.src = '/e2e-clip.webm'
      v.load()
      await loaded
      const seeked = new Promise((ok) => (v.onseeked = ok))
      v.currentTime = 1.2
      await seeked
      const c = document.createElement('canvas')
      c.width = v.videoWidth; c.height = v.videoHeight
      c.getContext('2d')!.drawImage(v, 0, 0)
      v.remove()
      return { w: c.width, h: c.height, len: c.toDataURL('image/jpeg', 0.8).length }
    })
    expect(r.w).toBeGreaterThan(0)
    expect(r.len).toBeGreaterThan(10_000)
  })
})
