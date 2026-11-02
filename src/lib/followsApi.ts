import { authClient } from './auth-client'

/** Follow targets the backend accepts (`/follows/:targetType/:targetId`). */
export type FollowTargetType = 'coach' | 'country'

export type FollowState = { following: boolean; followerCount: number }
export type MyFollows = { coaches: string[]; countries: string[] }

function unwrap<T>(res: unknown): (T & { error?: unknown }) | null {
  if (res == null) return null
  const r = res as { data?: unknown; error?: unknown }
  if (r.error) return null
  return ((r.data ?? res) as T & { error?: unknown }) ?? null
}

function targetPath(type: FollowTargetType, id: string): string {
  return `/follows/${type}/${encodeURIComponent(id.trim())}`
}

function toState(body: Partial<FollowState> | null): FollowState | null {
  if (!body || typeof body.following !== 'boolean') return null
  return { following: body.following, followerCount: Number(body.followerCount) || 0 }
}

/** Everything the signed-in user follows. Empty lists on any error, so lists still load. */
export async function fetchMyFollows(): Promise<MyFollows> {
  const res = await authClient
    .$fetch<MyFollows>('/follows/me', { method: 'GET', headers: { Accept: 'application/json' } })
    .catch(() => null)
  const body = unwrap<MyFollows>(res)
  return {
    coaches: Array.isArray(body?.coaches) ? body!.coaches : [],
    countries: Array.isArray(body?.countries) ? body!.countries : [],
  }
}

/** Whether the signed-in user follows one target, and its follower count. Null on error. */
export async function fetchFollowState(type: FollowTargetType, id: string): Promise<FollowState | null> {
  const res = await authClient
    .$fetch<FollowState>(targetPath(type, id), { method: 'GET', headers: { Accept: 'application/json' } })
    .catch(() => null)
  return toState(unwrap<FollowState>(res))
}

async function write(method: 'PUT' | 'DELETE', type: FollowTargetType, id: string): Promise<FollowState> {
  const res = await authClient
    .$fetch<FollowState>(targetPath(type, id), { method, headers: { Accept: 'application/json' } })
    .catch(() => null)
  const state = toState(unwrap<FollowState>(res))
  if (!state) throw new Error(method === 'PUT' ? 'Follow failed' : 'Unfollow failed')
  return state
}

/** Follow a coach or country. Throws on failure. */
export function followTarget(type: FollowTargetType, id: string): Promise<FollowState> {
  return write('PUT', type, id)
}

/** Unfollow a coach or country. Throws on failure. */
export function unfollowTarget(type: FollowTargetType, id: string): Promise<FollowState> {
  return write('DELETE', type, id)
}
