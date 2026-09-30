import { authClient } from './auth-client'
import { resolveUploadUrl } from './mediaUrl'

export type CoachDirectoryEntry = {
  id: string
  name: string
  username: string | null
  imageUri: string | null
}

type DirectoryUser = {
  id: string
  name: string
  image: string | null
  username: string | null
  coachStudentRole: 'coach' | 'student' | 'none'
}

/** Real coaches (`coachStudentRole === 'coach'`) from the shared user directory — the same
 * endpoint the friend/student search flow already uses, just filtered to coaches here. */
export async function fetchCoachDirectory(): Promise<CoachDirectoryEntry[]> {
  const res = await authClient
    .$fetch<{ users: DirectoryUser[]; error?: string }>('/profile/directory', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    .catch(() => null)
  if (res == null) return []
  const body = ((res as { data?: unknown })?.data ?? res) as
    | { users: DirectoryUser[]; error?: string }
    | null
  if (!body || body.error || !Array.isArray(body.users)) return []

  return body.users
    .filter((u) => u.coachStudentRole === 'coach')
    .map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      imageUri: resolveUploadUrl(u.image),
    }))
}
