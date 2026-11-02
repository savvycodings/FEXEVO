import { authClient } from './auth-client'
import { formatApiError } from './formatApiError'

/** Rating ranking for the Friends tab (BEXevo `/profile/gamification/ranking/...`). */

export type RankingScope = 'world' | 'club'

export type RankedPlayer = {
  rank: number
  userId: string
  name: string
  image: string | null
  city: string
  /** ISO code, or "" when the player's country is unknown. */
  countryCode: string
  countryName: string
  /** 0–100 overall technique score; null = no analysed shot yet. */
  rating: number | null
  totalXp: number
}

export type PlayerRankingResponse = {
  scope: RankingScope
  /** The requester's main club for `club`; null for `world` or when they have no club. */
  club: { id: string; slug: string; name: string } | null
  entries: RankedPlayer[]
}

export type RankedCountry = {
  rank: number
  code: string
  name: string
  rating: number
  playerCount: number
}

export type CountryRankingResponse = { entries: RankedCountry[] }

export type CountryClub = {
  id: string
  slug: string
  name: string
  city: string | null
  logoImageUrl: string | null
}

export type CountryDetail = {
  country: {
    code: string
    name: string
    rank: number | null
    totalCountries: number
    playerCount: number
    averageRating: number | null
    clubCount: number
  }
  topPlayers: RankedPlayer[]
  clubs: CountryClub[]
  topCities: Array<{ city: string; playerCount: number }>
}

export type RankingResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number }

async function getJson<T>(path: string, fallback: string): Promise<RankingResult<T>> {
  const res = await authClient
    .$fetch<T & { error?: string }>(path, { method: 'GET', headers: { Accept: 'application/json' } })
    .catch((err) => ({ error: formatApiError(err, 'Network error') }))
  if (res == null) return { ok: false, error: 'Could not reach the server' }
  const wrapped = res as {
    data?: T & { error?: string }
    error?: { status?: number; statusText?: string; message?: string } | string
  }
  if (wrapped.error && wrapped.data == null) {
    const status = typeof wrapped.error === 'object' && wrapped.error != null ? wrapped.error.status : undefined
    return { ok: false, error: formatApiError(wrapped.error, fallback), status }
  }
  const body = (wrapped.data ?? res) as T & { error?: string }
  if (body == null || body.error) return { ok: false, error: formatApiError(body?.error, fallback) }
  return { ok: true, data: body }
}

function normalizePlayer(p: RankedPlayer): RankedPlayer {
  return {
    ...p,
    rank: Number(p.rank) || 0,
    totalXp: Number(p.totalXp) || 0,
    rating: typeof p.rating === 'number' ? p.rating : null,
    city: p.city ?? '',
    countryCode: p.countryCode ?? '',
    countryName: p.countryName ?? '',
  }
}

function query(params: Record<string, string | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

export async function fetchPlayerRanking(opts: {
  scope: RankingScope
  friendsOnly?: boolean
  q?: string
}): Promise<RankingResult<PlayerRankingResponse>> {
  const r = await getJson<PlayerRankingResponse>(
    `/profile/gamification/ranking/players${query({
      scope: opts.scope,
      friendsOnly: opts.friendsOnly ? '1' : undefined,
      q: opts.q?.trim() || undefined,
    })}`,
    'Failed to load ranking',
  )
  if (!r.ok) return r
  if (!Array.isArray(r.data.entries)) return { ok: false, error: 'Invalid ranking response from server' }
  return {
    ok: true,
    data: { scope: r.data.scope ?? opts.scope, club: r.data.club ?? null, entries: r.data.entries.map(normalizePlayer) },
  }
}

export async function fetchCountryRanking(q?: string): Promise<RankingResult<CountryRankingResponse>> {
  const r = await getJson<CountryRankingResponse>(
    `/profile/gamification/ranking/countries${query({ q: q?.trim() || undefined })}`,
    'Failed to load country ranking',
  )
  if (!r.ok) return r
  if (!Array.isArray(r.data.entries)) return { ok: false, error: 'Invalid ranking response from server' }
  return { ok: true, data: { entries: r.data.entries } }
}

export async function fetchCountryDetail(code: string): Promise<RankingResult<CountryDetail>> {
  const r = await getJson<CountryDetail>(
    `/profile/gamification/ranking/countries/${encodeURIComponent(code.trim())}`,
    'Failed to load country',
  )
  if (!r.ok) return r
  if (!r.data.country || !Array.isArray(r.data.topPlayers)) {
    return { ok: false, error: 'Invalid country response from server' }
  }
  return {
    ok: true,
    data: {
      country: r.data.country,
      topPlayers: r.data.topPlayers.map(normalizePlayer),
      clubs: Array.isArray(r.data.clubs) ? r.data.clubs : [],
      topCities: Array.isArray(r.data.topCities) ? r.data.topCities : [],
    },
  }
}

/**
 * Every Rating on screen goes through here: the whole number with locale thousands separators
 * ("2,485" in en), or "–" when there is none. Change the display scale here only.
 */
export function formatRating(n: number | null | undefined, locale?: string): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '–'
  return Math.round(n).toLocaleString(locale ?? 'en-US')
}
