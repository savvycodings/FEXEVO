import { authClient } from './auth-client'
import { resolveUploadUrl } from './mediaUrl'

export type ClubCourt = {
  id: string
  name: string
  indoorOutdoor: 'indoor' | 'outdoor' | 'covered'
  hasLighting: boolean
}

export type ClubSummary = {
  id: string
  slug: string
  name: string
  description: string | null
  address: string
  city: string | null
  region: string | null
  country: string | null
  phone: string | null
  email: string | null
  website: string | null
  hoursText: string | null
  bannerImageUrl: string | null
  logoImageUrl: string | null
  courts: ClubCourt[]
  amenityKeys: string[]
  galleryImageUrls: string[]
  /** Players in the `member` state. Older backends omit it. */
  memberCount?: number
  /** The signed-in viewer's record with this club (club detail only). */
  myMembership?: MyClubMembership
}

export type ClubMembershipState = 'none' | 'invited' | 'requested' | 'member'

export type MyClubMembership = {
  state: ClubMembershipState
  /** Record id; null when state is `none`. */
  id: string | null
  isMain: boolean
}

/** A club as embedded in invites and "my clubs". */
export type ClubCardInfo = {
  id: string
  slug: string
  name: string
  logoImageUrl: string | null
  city: string | null
  country: string | null
  memberCount: number
}

export type ClubInvite = {
  id: string
  createdAt: string
  club: ClubCardInfo
}

export type MyClub = ClubCardInfo & { membershipId: string; isMain: boolean; joinedAt: string | null }

/** Result of a membership action: the new state plus the club's fresh member count. */
export type MembershipActionResult = {
  state: ClubMembershipState
  isMain: boolean
  memberCount: number
  membership: { id: string; clubId: string; state: ClubMembershipState; isMain: boolean } | null
}

async function fetchClubJson<T>(path: string): Promise<T | null> {
  const res = await authClient
    .$fetch<T & { error?: string }>(path, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    .catch(() => null)
  if (res == null) return null
  const body = ((res as { data?: unknown })?.data ?? res) as (T & { error?: string }) | null
  if (!body || (body as { error?: string }).error) return null
  return body as T
}

/** Approved clubs only — matches BEXevo's public `/club` listing. */
export async function fetchClubs(): Promise<ClubSummary[]> {
  const body = await fetchClubJson<{ clubs: ClubSummary[] }>('/club')
  return body?.clubs ?? []
}

export async function fetchClubDetail(slug: string): Promise<ClubSummary | null> {
  const body = await fetchClubJson<{ club: ClubSummary }>(`/club/${encodeURIComponent(slug)}`)
  return body?.club ?? null
}

export function clubBannerUri(club: Pick<ClubSummary, 'bannerImageUrl'>): string | null {
  return resolveUploadUrl(club.bannerImageUrl)
}

export function clubLogoUri(club: Pick<ClubSummary, 'logoImageUrl'>): string | null {
  return resolveUploadUrl(club.logoImageUrl)
}

export function clubGalleryUris(club: Pick<ClubSummary, 'galleryImageUrls'>): string[] {
  return club.galleryImageUrls
    .map((url) => resolveUploadUrl(url))
    .filter((uri): uri is string => uri != null)
}

export class ClubsApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ClubsApiError'
  }
}

type FetchResult = { data?: unknown; error?: { status?: number; message?: string; error?: string } | null }

/** JSON call through the auth client; throws ClubsApiError on a non-2xx answer. */
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
    throw new ClubsApiError(0, e instanceof Error ? e.message : 'Network error')
  }
  if (res?.error) {
    throw new ClubsApiError(res.error.status ?? 0, res.error.error || res.error.message || 'Request failed')
  }
  return ((res as { data?: unknown } | null)?.data ?? res) as T
}

const M = '/club-memberships'

/** Pending club invites for the signed-in player, newest first. */
export async function fetchClubInvites(): Promise<ClubInvite[]> {
  const body = await call<{ invites?: ClubInvite[] }>(`${M}/invites`)
  return Array.isArray(body?.invites) ? body.invites : []
}

export function acceptClubInvite(membershipId: string): Promise<MembershipActionResult> {
  return call(`${M}/invites/${encodeURIComponent(membershipId)}/accept`, 'POST')
}

export async function declineClubInvite(membershipId: string): Promise<void> {
  await call(`${M}/invites/${encodeURIComponent(membershipId)}/decline`, 'POST')
}

/** Ask to join; becomes `member` right away if the club already invited you. */
export function requestToJoinClub(clubId: string): Promise<MembershipActionResult> {
  return call(`${M}/requests`, 'POST', { clubId })
}

export async function cancelJoinRequest(membershipId: string): Promise<void> {
  await call(`${M}/requests/${encodeURIComponent(membershipId)}`, 'DELETE')
}

export function leaveClub(clubId: string): Promise<MembershipActionResult> {
  return call(`${M}/clubs/${encodeURIComponent(clubId)}`, 'DELETE')
}

export function setMainClub(clubId: string): Promise<MembershipActionResult> {
  return call(`${M}/clubs/${encodeURIComponent(clubId)}/main`, 'POST')
}

/** Clubs the signed-in player belongs to: main club first, then in order joined. */
export async function fetchMyClubs(): Promise<MyClub[]> {
  const body = await call<{ clubs?: MyClub[] }>(`${M}/mine`)
  return Array.isArray(body?.clubs) ? body.clubs : []
}
