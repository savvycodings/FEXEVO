import path from 'path'
import { expect, request, test } from '@playwright/test'
import { API_URL, FIXTURE_VIDEO, authStatePath } from './env'
import { T, nav, openApp } from './helpers'

test.use({ storageState: authStatePath('player') })

test('upload → analysis results → Magic Shot → Activities', async ({ page }) => {
  test.setTimeout(180_000)
  await openApp(page)
  await nav(page, 'Main', { screen: 'AICoach', params: { screen: 'AICoachMain' } })

  await page.getByTestId(T.techniqueChooseFile).click()
  await page.getByTestId(T.howToAccept).click()
  await page.getByTestId(T.shotCategory('net_play')).click()
  await page.getByTestId(T.shotOption('forehand_volley')).click()
  await page.getByTestId(T.viewAngle('front')).click()
  await page.getByTestId(T.viewAngleConfirm).click()

  const chooser = page.waitForEvent('filechooser')
  await page.getByTestId(T.setClipContinue).click()
  await (await chooser).setFiles(path.resolve(FIXTURE_VIDEO))

  // Upload + analysis (fixture analyzer and write-up in fakes mode)
  const analyzed = page.waitForResponse((r) => r.url().includes('/technique/analyze') && r.request().method() === 'POST', { timeout: 90_000 })
  await page.getByTestId(T.techniqueAnalyse).click()
  const analyzeRes = await analyzed
  expect(analyzeRes.status()).toBe(200)
  const { analysisId } = (await analyzeRes.json()) as { analysisId: string }
  await expect(page.getByTestId(T.techniqueScore)).toHaveText(/\d+/, { timeout: 30_000 })

  // Magic Shot: start the correction-video job and wait for it to finish
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
