import { authClient } from './auth-client'

export type CoachProfileSection = {
  id: string
  coachUserId: string
  heading: string
  body: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

function normalizeSection(
  row: Partial<CoachProfileSection> | null | undefined
): CoachProfileSection | null {
  if (!row || typeof row.id !== 'string' || !row.id.trim()) return null
  const heading = typeof row.heading === 'string' ? row.heading.trim() : ''
  const body = typeof row.body === 'string' ? row.body.trim() : ''
  if (!heading || !body) return null
  return {
    id: row.id.trim(),
    coachUserId: typeof row.coachUserId === 'string' ? row.coachUserId : '',
    heading,
    body,
    sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : 0,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(0).toISOString(),
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date(0).toISOString(),
  }
}

export async function fetchCoachProfileSections(
  coachUserId: string
): Promise<CoachProfileSection[]> {
  const trimmed = coachUserId.trim()
  if (!trimmed) return []

  const res = await authClient
    .$fetch(`/coach/profile-sections/${encodeURIComponent(trimmed)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    .catch(() => null)

  const body = ((res as { data?: unknown })?.data ?? res) as {
    sections?: CoachProfileSection[]
    error?: string
  }

  if (!Array.isArray(body?.sections)) return []
  return body.sections
    .map((row) => normalizeSection(row))
    .filter((row): row is CoachProfileSection => row != null)
}

export async function createCoachProfileSection(input: {
  heading: string
  body: string
}): Promise<CoachProfileSection> {
  const res = await authClient
    .$fetch('/coach/profile-sections', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: {
        heading: input.heading,
        body: input.body,
      },
    })
    .catch(() => null)

  const payload = ((res as { data?: unknown })?.data ?? res) as {
    ok?: boolean
    section?: CoachProfileSection
    error?: string
  }

  const section = normalizeSection(payload?.section)
  if (!section) {
    throw new Error(
      typeof payload?.error === 'string' ? payload.error : 'Failed to save section'
    )
  }
  return section
}
