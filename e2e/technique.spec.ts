import path from 'path'
import { expect, request, test } from '@playwright/test'
import { API_URL, FIXTURE_VIDEO, authStatePath } from './env'
import { T, openApp, uploadAndAnalyze, openMagicShot } from './helpers'

test.use({ storageState: authStatePath('player') })

test('upload → analysis results → Magic Shot → Activities', async ({ page }) => {
  test.setTimeout(180_000)
  await openApp(page)
  const analysisId = await uploadAndAnalyze(page, path.resolve(FIXTURE_VIDEO))

  // Magic Shot: start the correction-video job and wait for it to finish
  await openMagicShot(page)
  await page.getByTestId(T.magicShotGenerate).click()
  const api = await request.newContext({ baseURL: API_URL, storageState: authStatePath('player') })
  await expect(async () => {
    const r = await api.get(`/api/auth/technique/analysis/${analysisId}/correction-videos`)
    const body = (await r.json()) as { status?: string; video?: string; error?: string }
    expect(body.status, JSON.stringify(body)).toBe('done')
    expect(body.video).toBeTruthy()
  }).toPass({ timeout: 90_000, intervals: [2_000] })
  const done = (await (await api.get(`/api/auth/technique/analysis/${analysisId}/correction-videos`)).json()) as { video: string }
  // The video is checked by fetching it (bundled Chromium can't decode H.264).
  const vid = await api.get(done.video)
  expect(vid.status()).toBe(200)
  expect((await vid.body()).subarray(4, 8).toString()).toBe('ftyp')
  await api.dispose()

  // Activities lists the analysis
  await page.getByTestId(T.tab('Activities')).click()
  const list = await page.request.get(`${API_URL}/api/auth/technique/activities`)
  const items = ((await list.json()) as { items: Array<{ analysisId: string }> }).items
  expect(items.map((i) => i.analysisId)).toContain(analysisId)
})
