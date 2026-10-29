import path from 'path'
import { expect, request, test } from '@playwright/test'
import { API_URL, FIXTURE_VIDEO, authStatePath } from './env'
import { T, openApp, uploadAndAnalyze, openMagicShot } from './helpers'

test.use({ storageState: authStatePath('player') })

type VideoStatus = {
  status: string
  video: string | null
  poseVideo: string | null
  startImage: string | null
  overlayVideo: string | null
  corrections: Array<{ region: string; sentence: string }> | null
  correction_context_videos_comfy: { pipeline?: string; provider?: string; pro_reference_id?: string; estimated_cost_usd?: number } | null
  error: string | null
}

async function setFlags(body: Record<string, unknown>) {
  const api = await request.newContext({ baseURL: API_URL })
  await api.post('/__e2e/flags', { data: body })
  await api.dispose()
}

async function magicShot(page: import('@playwright/test').Page, timeoutMs: number): Promise<VideoStatus> {
  await openApp(page)
  const analysisId = await uploadAndAnalyze(page, path.resolve(FIXTURE_VIDEO))
  await openMagicShot(page)
  await page.getByTestId(T.magicShotGenerate).click()
  const api = await request.newContext({ baseURL: API_URL, storageState: authStatePath('player') })
  let last: VideoStatus | null = null
  await expect(async () => {
    last = (await (await api.get(`/api/auth/technique/analysis/${analysisId}/correction-videos`)).json()) as VideoStatus
    expect(last.status, JSON.stringify(last)).toBe('done')
  }).toPass({ timeout: timeoutMs, intervals: [3_000] })
  const done = last as unknown as VideoStatus
  for (const k of ['video', 'poseVideo', 'startImage', 'overlayVideo'] as const) {
    const r = await api.get(done[k]!)
    expect(r.status(), k).toBe(200)
    if (k !== 'startImage') expect((await r.body()).subarray(4, 8).toString(), `${k} is an MP4`).toBe('ftyp')
  }
  await api.dispose()
  await expect(page.getByTestId(T.magicShotResult)).toBeVisible({ timeout: 30_000 })
  return done
}

test('Magic Shot video (pose correction): result with video, overlay and corrections', async ({ page }) => {
  test.setTimeout(180_000)
  await setFlags({ realVideo: false, fakeVideoFail: false })
  const done = await magicShot(page, 90_000)
  expect(done.correction_context_videos_comfy?.pipeline).toBe('pose-correction')
  expect(done.correction_context_videos_comfy?.pro_reference_id).toBe('fh-volley-front-42cf0eba')
  expect(Array.isArray(done.corrections)).toBe(true)
})

test('Magic Shot video on the real model @live', async ({ page }) => {
  test.setTimeout(600_000)
  await setFlags({ realVideo: true, fakeVideoFail: false })
  try {
    const done = await magicShot(page, 540_000)
    expect(done.correction_context_videos_comfy?.provider).toBe('fal-wan-vace-pose')
    console.log('LIVE', JSON.stringify(done.correction_context_videos_comfy))
  } finally {
    await setFlags({ realVideo: false })
  }
})
