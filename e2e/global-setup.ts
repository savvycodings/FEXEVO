import { request, type FullConfig } from '@playwright/test'
import { ACCOUNTS, API_URL, PASSWORD, authStatePath, type Role } from './env'

/**
 * Refuses anything but a local backend in fakes mode, seeds the accounts, and saves a signed-in
 * storage state per role so specs can skip the login UI.
 */
export default async function globalSetup(config: FullConfig) {
  const webOrigin = String(config.projects[0]?.use.baseURL ?? 'http://localhost:8090')
  const api = await request.newContext({ baseURL: API_URL })
  const health = await api.get('/__e2e/health').catch(() => null)
  if (!health || !health.ok()) {
    throw new Error(`E2E: ${API_URL}/__e2e/health is not reachable. Start BEXevo with \`pnpm dev:e2e\` (fakes mode).`)
  }
  const h = (await health.json()) as { fakes: boolean; dbEndpoint: string | null }
  if (!h.fakes) throw new Error('E2E: the backend is not in fakes mode (XEVO_E2E_FAKES=1). Refusing to run.')
  const prod = process.env.E2E_PROD_DB_ENDPOINT
  const local = h.dbEndpoint === 'localhost' || h.dbEndpoint === '127'
  if ((prod && h.dbEndpoint === prod) || (!local && process.env.E2E_ALLOW_REMOTE_DB !== '1')) {
    throw new Error(`E2E: refusing to run against database endpoint "${h.dbEndpoint}" (not the local test database).`)
  }

  const seed = await api.post('/__e2e/seed')
  if (!seed.ok()) throw new Error(`E2E: seeding failed: ${await seed.text()}`)

  for (const role of Object.keys(ACCOUNTS) as Role[]) {
    const ctx = await request.newContext({ baseURL: API_URL, extraHTTPHeaders: { Origin: webOrigin } })
    const res = await ctx.post('/api/auth/sign-in/email', { data: { email: ACCOUNTS[role], password: PASSWORD } })
    if (!res.ok()) throw new Error(`E2E: sign-in failed for ${role}: ${res.status()} ${await res.text()}`)
    await ctx.storageState({ path: authStatePath(role) })
    await ctx.dispose()
  }
  await api.dispose()
}
