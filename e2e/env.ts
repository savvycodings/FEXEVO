export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3050'
export const PASSWORD = 'E2E-test-password-1!'
export const ACCOUNTS = {
  player: 'e2e-player@xevo.test',
  coach: 'e2e-coach@xevo.test',
  admin: 'e2e-admin@xevo.test',
} as const
export type Role = keyof typeof ACCOUNTS
export const ADMIN_GATE_PASSWORD = process.env.E2E_ADMIN_GATE_PASSWORD ?? 'e2e-admin-gate'
export const authStatePath = (role: Role) => `e2e/.auth/${role}.json`
export const FIXTURE_VIDEO = '../BEXevo/src/e2e/fixtures/player-forehand-volley.mp4'
