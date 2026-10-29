import { authClient } from './auth-client'
import { resolveUploadUrl } from './mediaUrl'

export type Friend = {
  id: string
  name: string
  username: string | null
  imageUri: string | null
  areaLocation: string | null
  /** How you're linked: they coach you, or you coach them. */
  relation: 'coach' | 'student'
}

type Row = {
  id: string
  name: string
  image: string | null
  username?: string | null
  areaLocation?: string | null
}

async function getRows(path: string, key: 'coaches' | 'students'): Promise<Row[]> {
  const res = await authClient
    .$fetch<Record<string, Row[]>>(path, { method: 'GET', headers: { Accept: 'application/json' } })
    .catch(() => null)
  const body = ((res as { data?: unknown } | null)?.data ?? res) as Record<string, unknown> | null
  const rows = body?.[key]
  return Array.isArray(rows) ? (rows as Row[]) : []
}

/** Friends are your coach–student links, the same set the leaderboard's Friends scope uses. */
export async function fetchMyFriends(): Promise<Friend[]> {
  const [coaches, students] = await Promise.all([
    getRows('/profile/student-coaches', 'coaches'),
    getRows('/profile/coach-students', 'students'),
  ])
  const out = new Map<string, Friend>()
  const add = (r: Row, relation: Friend['relation']) => {
    if (out.has(r.id)) return
    out.set(r.id, {
      id: r.id,
      name: r.name,
      username: r.username ?? null,
      imageUri: resolveUploadUrl(r.image),
      areaLocation: r.areaLocation?.trim() || null,
      relation,
    })
  }
  coaches.forEach((r) => add(r, 'coach'))
  students.forEach((r) => add(r, 'student'))
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name))
}
