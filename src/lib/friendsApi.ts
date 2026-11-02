import { authClient } from './auth-client'
import { resolveUploadUrl } from './mediaUrl'

export type Friend = {
  id: string
  name: string
  username: string | null
  imageUri: string | null
  areaLocation: string | null
  /** How you're linked: they coach you, you coach them, or an accepted friend request. */
  relation: 'coach' | 'student' | 'friend'
}

type Row = {
  id: string
  name: string
  image: string | null
  username?: string | null
  areaLocation?: string | null
}

export class FriendsApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'FriendsApiError'
  }
}

type FetchResult = { data?: unknown; error?: { status?: number; message?: string; error?: string } | null }

/** JSON call through the auth client; throws FriendsApiError on a non-2xx answer. */
async function call<T>(path: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', body?: unknown): Promise<T> {
  let res: FetchResult | null
  try {
    res = (await authClient.$fetch(path, {
      method,
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      // Serialize here: on web the auth client's fetch sends a plain object as "[object Object]".
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })) as FetchResult
  } catch (e) {
    throw new FriendsApiError(0, e instanceof Error ? e.message : 'Network error')
  }
  if (res?.error) {
    throw new FriendsApiError(res.error.status ?? 0, res.error.error || res.error.message || 'Request failed')
  }
  return ((res as { data?: unknown } | null)?.data ?? res) as T
}

async function getRows(path: string, key: 'coaches' | 'students' | 'friends'): Promise<Row[]> {
  const body = await call<Record<string, unknown>>(path).catch(() => null)
  const rows = body?.[key]
  return Array.isArray(rows) ? (rows as Row[]) : []
}

/**
 * My Friends: coach–student links plus accepted friendships, the same set the leaderboard's
 * Friends scope uses. Someone linked more than one way shows once, as coach or student.
 */
export async function fetchMyFriends(): Promise<Friend[]> {
  const [coaches, students, friends] = await Promise.all([
    getRows('/profile/student-coaches', 'coaches'),
    getRows('/profile/coach-students', 'students'),
    getRows('/friends', 'friends'),
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
  friends.forEach((r) => add(r, 'friend'))
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export type MutualFriend = { id: string; name: string; imageUri: string | null }
export type MutualFriends = { count: number; friends: MutualFriend[] }

type RawMutual = { count?: number; friends?: Array<{ id: string; name: string; image: string | null }> }

function mapMutual(raw: RawMutual | null | undefined): MutualFriends {
  return {
    count: Number(raw?.count) || 0,
    friends: (raw?.friends ?? []).map((f) => ({ id: f.id, name: f.name, imageUri: resolveUploadUrl(f.image) })),
  }
}

export type FriendRequest = {
  id: string
  createdAt: string
  sender: {
    id: string
    name: string
    imageUri: string | null
    areaLocation: string | null
  }
  mutual: MutualFriends
}

type RawRequest = {
  id: string
  createdAt: string
  sender: { id: string; name: string; image: string | null; areaLocation: string | null }
  mutual: RawMutual
}

function mapRequest(r: RawRequest): FriendRequest {
  return {
    id: r.id,
    createdAt: r.createdAt,
    sender: {
      id: r.sender.id,
      name: r.sender.name,
      imageUri: resolveUploadUrl(r.sender.image),
      areaLocation: r.sender.areaLocation?.trim() || null,
    },
    mutual: mapMutual(r.mutual),
  }
}

/** Pending requests sent to me, newest first. */
export async function fetchIncomingRequests(): Promise<FriendRequest[]> {
  const body = await call<{ requests?: RawRequest[] }>('/friends/requests/incoming')
  return (body?.requests ?? []).map(mapRequest)
}

export type SendRequestResult = { requestId: string; status: 'pending' | 'accepted' }

export async function sendFriendRequest(toUserId: string): Promise<SendRequestResult> {
  const body = await call<{ request: { id: string }; status: 'pending' | 'accepted' }>('/friends/requests', 'POST', {
    toUserId,
  })
  return { requestId: body.request.id, status: body.status }
}

export async function acceptRequest(requestId: string): Promise<void> {
  await call(`/friends/requests/${encodeURIComponent(requestId)}/accept`, 'POST')
}

export async function declineRequest(requestId: string): Promise<void> {
  await call(`/friends/requests/${encodeURIComponent(requestId)}/decline`, 'POST')
}

export async function cancelRequest(requestId: string): Promise<void> {
  await call(`/friends/requests/${encodeURIComponent(requestId)}`, 'DELETE')
}

export async function unfriend(userId: string): Promise<void> {
  await call(`/friends/${encodeURIComponent(userId)}`, 'DELETE')
}

export type RelationshipStatus = 'none' | 'outgoing_pending' | 'incoming_pending' | 'friends'
export type Relationship = { status: RelationshipStatus; requestId: string | null; mutual: MutualFriends }

export async function fetchRelationship(userId: string): Promise<Relationship> {
  const body = await call<{ status: RelationshipStatus; requestId?: string; mutual?: RawMutual }>(
    `/friends/relationship/${encodeURIComponent(userId)}`,
  )
  return { status: body.status, requestId: body.requestId ?? null, mutual: mapMutual(body.mutual) }
}

export type FriendRequestDetail = {
  requestId: string
  createdAt: string
  sender: {
    id: string
    name: string
    imageUri: string | null
    areaLocation: string | null
    level: string | null
    courtSide: string | null
    dominantHand: string | null
    overallScore: number | null
    about: string | null
  }
  mutual: MutualFriends
}

/** Sender profile for the request detail screen. Throws FriendsApiError(404) once it's no longer pending. */
export async function fetchRequestDetail(requestId: string): Promise<FriendRequestDetail> {
  const body = await call<{
    request: { id: string; createdAt: string }
    sender: Omit<FriendRequestDetail['sender'], 'imageUri'> & { image: string | null }
    mutual: RawMutual
  }>(`/friends/requests/${encodeURIComponent(requestId)}`)
  const { image, ...sender } = body.sender
  return {
    requestId: body.request.id,
    createdAt: body.request.createdAt,
    sender: { ...sender, imageUri: resolveUploadUrl(image), areaLocation: sender.areaLocation?.trim() || null },
    mutual: mapMutual(body.mutual),
  }
}
