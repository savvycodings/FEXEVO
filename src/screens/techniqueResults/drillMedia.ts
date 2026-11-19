import { DOMAIN } from '../../../constants'
import type { Drill, DrillFocus, DrillKeyPointIcon } from '../../lib/drillsApi'

export type DrillStepMedia = {
  title: string
  summary: string
  task: string
  focus: string[]
  practice: string
  minutes: string
  /** Absolute playback URL, or null for placeholder player. */
  videoUri: string | null
}

export type DrillMediaPack = {
  id: string
  name: string
  shotLabel: string
  subtitle: string
  steps: DrillStepMedia[]
  /** Body-part focus for ranking / focus line (optional). */
  focusParts?: DrillFocus[]
}

const PRODUCTION_DRILLS_BASE = 'https://bexevo-production.up.railway.app'

function drillsMediaUrl(shot: string, file: string): string {
  // Drills live on Railway production. Prefer an explicit override; otherwise
  // use DOMAIN only when it already points at BEXEVO production (not ngrok/dev).
  const explicit = process.env.EXPO_PUBLIC_DRILLS_MEDIA_BASE_URL?.trim()
  const domain = (DOMAIN || '').replace(/\/$/, '')
  const domainIsProd =
    /bexevo-production\.up\.railway\.app/i.test(domain) ||
    /bexevo\.up\.railway\.app/i.test(domain)
  const base = (explicit || (domainIsProd ? domain : '') || PRODUCTION_DRILLS_BASE).replace(
    /\/$/,
    ''
  )
  return `${base}/drills/media/${shot}/${file}`
}

const PRACTICE = '3 sets x 8 repetitions'
const MINUTES = '~ 2 min'

const BANDEJA_STEPS: DrillStepMedia[] = [
  {
    title: 'Prepare without the racket',
    summary:
      'Move backward while preparing the bandeja motion, loading weight onto the right leg and taking the ball at the would-be impact point, keeping the left hand close to the impact.',
    task: 'Perform the full movement without a racket, focusing on footwork and contact point.',
    focus: [
      'Move back early and stay balanced.',
      'Catch the ball in front and above your shoulder.',
    ],
    practice: PRACTICE,
    minutes: MINUTES,
    videoUri: drillsMediaUrl('bandeja', '01-primary.mp4'),
  },
  {
    title: 'Without the ball',
    summary:
      'The player retreats sideways while preparing the bandeja, loading weight on the right leg and transferring weight forward. Impact point at head height, left hand near impact, and hip rotation.',
    task: 'Shadow the bandeja with racket: side retreat, load, and hip turn — no ball yet.',
    focus: [
      'Retreat sideways with racket ready.',
      'Impact shape at head height with hip rotation.',
    ],
    practice: PRACTICE,
    minutes: MINUTES,
    videoUri: drillsMediaUrl('bandeja', '02-secondary.mp4'),
  },
  {
    title: 'Add the ball',
    summary:
      'The player waits at mid-court without moving backward, waits for the ball to arrive, and contacts it out in front (execution with ball).',
    task: 'Hit live bandejas from mid-court, contacting the ball out in front.',
    focus: [
      'Wait mid-court — do not force a late backpedal.',
      'Contact the ball in front of the body.',
    ],
    practice: PRACTICE,
    minutes: MINUTES,
    videoUri: drillsMediaUrl('bandeja', '03-tertiary.mp4'),
  },
  {
    title: 'Put it together',
    summary:
      'Movement from the ready position at the net: retreat sideways, racket up, elbow at 90°, continental grip, and transfer weight from back to front.',
    task: 'Full pattern from net-ready into a finished bandeja.',
    focus: [
      'From net ready: side retreat, racket up, 90° elbow.',
      'Continental grip and weight through to the front foot.',
    ],
    practice: PRACTICE,
    minutes: MINUTES,
    videoUri: drillsMediaUrl('bandeja', '04-final.mp4'),
  },
]

const OVERHEAD_STEPS: DrillStepMedia[] = [
  {
    title: 'High contact point',
    summary:
      'Initial flat-smash work seeking a high impact point where the player feels the ball above and in front of them.',
    task: 'Find a high contact point with the ball above and in front of you.',
    focus: [
      'Feel the ball above and in front.',
      'Keep the swing compact and controlled.',
    ],
    practice: PRACTICE,
    minutes: MINUTES,
    videoUri: drillsMediaUrl('remate-plano', '01-primary.mp4'),
  },
  {
    title: 'Move forward from the glass',
    summary:
      'Starting about 4 meters from the back glass, moving closer to the net each time while keeping the body sideways, the impact point in front, and a flat finish.',
    task: 'Start near the back glass and work toward the net with a sideways body and flat finish.',
    focus: [
      'Body sideways, impact in front.',
      'Finish flat as you move closer to the net.',
    ],
    practice: PRACTICE,
    minutes: MINUTES,
    videoUri: drillsMediaUrl('remate-plano', '02-secondary.mp4'),
  },
  {
    title: 'Shadow the swing path',
    summary:
      'The player hides the racket behind their head, loads weight on the right leg and transfers weight forward marking impact with the right hand, shoulders sideways, starting the shot on the right side and finishing out the left side.',
    task: 'Slow the swing path: load the back leg, mark contact, finish across the body.',
    focus: [
      'Hide the racket behind the head before swinging.',
      'Start right-side, finish out the left.',
    ],
    practice: PRACTICE,
    minutes: MINUTES,
    videoUri: drillsMediaUrl('remate-plano', '03-tertiary.mp4'),
  },
  {
    title: 'Finish detail',
    summary: 'Detail of the flat-smash finish in slow motion.',
    task: 'Lock in the flat-smash finish — follow through and recovery.',
    focus: [
      'Complete a flat finish.',
      'Recover ready for the next ball.',
    ],
    practice: PRACTICE,
    minutes: MINUTES,
    videoUri: drillsMediaUrl('remate-plano', '04-final.mp4'),
  },
]

const TOPSIN_SMASH_STEPS: DrillStepMedia[] = [
  {
    title: 'Lift and wrap the ball',
    summary:
      'The racket comes out hidden from behind the head and, without pronating the arm, continues lifting and wrapping the ball by going over it so it leaves with forward spin and climbs the glass.',
    task: 'Hide the racket behind the head, then lift and wrap over the ball for topspin.',
    focus: [
      'No arm pronation — lift and wrap over the ball.',
      'Finish so the ball climbs the glass with forward spin.',
    ],
    practice: PRACTICE,
    minutes: MINUTES,
    videoUri: drillsMediaUrl('remate-liftado', '01-primary.mp4'),
  },
]

const FOREHAND_VOLLEY_STEPS: DrillStepMedia[] = [
  {
    title: 'Demo without the racket',
    summary: 'Initial forehand-volley progression (demo without racket).',
    task: 'Shadow the forehand volley pattern without a racket.',
    focus: [
      'Compact preparation.',
      'Meet the ball out in front.',
    ],
    practice: PRACTICE,
    minutes: MINUTES,
    videoUri: drillsMediaUrl('volea-derecha', '01-primary.mp4'),
  },
  {
    title: 'Block the volley',
    summary: 'Forehand-volley progression focused on the block.',
    task: 'Practice a firm block on the forehand volley.',
    focus: [
      'Firm wrist and short contact.',
      'Absorb and redirect — do not swing big.',
    ],
    practice: PRACTICE,
    minutes: MINUTES,
    videoUri: null,
  },
  {
    title: 'Impact in front',
    summary:
      'Impact in front of the body while rotating the hip and transferring weight forward; the racket tip goes forward following the ball, then recover holding the racket with two hands.',
    task: 'Volley with impact in front, hip turn, and two-handed recovery.',
    focus: [
      'Impact in front with hip rotation.',
      'Recover holding the racket with two hands.',
    ],
    practice: PRACTICE,
    minutes: MINUTES,
    videoUri: null,
  },
]

const BACKHAND_VOLLEY_STEPS: DrillStepMedia[] = [
  {
    title: 'Hands together, hip turn',
    summary:
      'Hands-together drill rotating the hip without moving the legs, to transfer weight well through the hip and into the leg.',
    task: 'Keep hands together and rotate the hip without stepping.',
    focus: [
      'Hands stay together through the turn.',
      'Transfer weight through the hip into the leg.',
    ],
    practice: PRACTICE,
    minutes: MINUTES,
    videoUri: drillsMediaUrl('volea-reves', '01-primary.mp4'),
  },
]

const DRILLS: Record<string, DrillMediaPack> = {
  'bandeja-drill': {
    id: 'bandeja-drill',
    name: 'Bandeja Drill',
    shotLabel: 'Bandeja',
    subtitle: 'Build a more consistent bandeja with the right preparation and contact.',
    focusParts: ['foot', 'racket', 'torso'],
    steps: BANDEJA_STEPS,
  },
  'overhead-positioning': {
    id: 'overhead-positioning',
    name: 'Overhead Positioning',
    shotLabel: 'Overhead',
    subtitle: 'Improve your overhead position and spacing.',
    focusParts: ['elbow', 'racket', 'torso'],
    steps: OVERHEAD_STEPS,
  },
  'topspin-smash': {
    id: 'topspin-smash',
    name: 'Topsin Smash',
    shotLabel: 'Topsin smash',
    subtitle: 'Lift and wrap the ball so it climbs the glass with forward spin.',
    steps: TOPSIN_SMASH_STEPS,
  },
  'forehand-volley': {
    id: 'forehand-volley',
    name: 'Forehand Volley',
    shotLabel: 'Forehand volley',
    subtitle: 'Build a compact forehand volley from the block to impact in front.',
    steps: FOREHAND_VOLLEY_STEPS,
  },
  'backhand-volley': {
    id: 'backhand-volley',
    name: 'Backhand Volley',
    shotLabel: 'Backhand volley',
    subtitle: 'Train hip transfer on the sliced backhand volley.',
    steps: BACKHAND_VOLLEY_STEPS,
  },
  'recovery-balance': {
    id: 'recovery-balance',
    name: 'Recovery & Balance',
    shotLabel: 'Recovery',
    subtitle: 'Recover after the overhead and get ready for the next shot.',
    focusParts: ['foot', 'torso'],
    steps: [
      {
        title: 'Recover to ready',
        summary: 'Recover after the overhead and get ready for the next shot.',
        task: 'After contact, recover to a balanced ready position.',
        focus: ['Split-step after the smash.', 'Eyes up for the next ball.'],
        practice: PRACTICE,
        minutes: MINUTES,
        videoUri: null,
      },
      {
        title: 'Balance through contact',
        summary: 'Stay balanced through the overhead contact.',
        task: 'Hold balance through contact without falling into the net.',
        focus: ['Stable base.', 'Controlled finish.'],
        practice: PRACTICE,
        minutes: MINUTES,
        videoUri: null,
      },
      {
        title: 'First step after smash',
        summary: 'Take a sharp first recovery step after the smash.',
        task: 'Explode into the first recovery step after finishing.',
        focus: ['Quick first step.', 'Racket up in ready.'],
        practice: PRACTICE,
        minutes: MINUTES,
        videoUri: null,
      },
      {
        title: 'Link to next ball',
        summary: 'Link recovery into the next defensive or volley ball.',
        task: 'Finish the smash and immediately prepare for the reply.',
        focus: ['Eyes on the reply.', 'Ready stance early.'],
        practice: PRACTICE,
        minutes: MINUTES,
        videoUri: null,
      },
    ],
  },
}

/** Ordered list of suggested-drill card ids (for Next Drill). */
export const SUGGESTED_DRILL_IDS = [
  'bandeja-drill',
  'overhead-positioning',
  'topspin-smash',
  'forehand-volley',
  'backhand-volley',
  'recovery-balance',
] as const

export function getNextSuggestedDrillId(currentId: string | null | undefined): string {
  const idx = SUGGESTED_DRILL_IDS.indexOf(currentId as (typeof SUGGESTED_DRILL_IDS)[number])
  const next = idx >= 0 ? (idx + 1) % SUGGESTED_DRILL_IDS.length : 1
  return SUGGESTED_DRILL_IDS[next]
}

export function getDrillMediaPack(drillId: string | null | undefined): DrillMediaPack {
  if (drillId && DRILLS[drillId]) return DRILLS[drillId]
  return DRILLS['bandeja-drill']
}

/** Exact pack for a drill slug, or null (no bandeja fallback). */
export function findDrillMediaPack(drillId: string | null | undefined): DrillMediaPack | null {
  if (!drillId) return null
  return DRILLS[drillId] ?? null
}

/** Media packs that match this analysis shot (bandeja / remate / overhead). */
export function mediaPacksForShot(
  shotLabel: string | null | undefined,
  strokePreset?: string | null
): DrillMediaPack[] {
  const text = `${shotLabel ?? ''} ${strokePreset ?? ''}`.toLowerCase().replace(/[_-]+/g, ' ')
  if (!text.trim()) return []
  const out: DrillMediaPack[] = []
  if (/bandeja/.test(text)) out.push(DRILLS['bandeja-drill']!)
  if (/remate|smash|overhead|vibora|v[ií]bora/.test(text)) {
    out.push(DRILLS['overhead-positioning']!)
    out.push(DRILLS['recovery-balance']!)
  }
  return out
}

/** Turn a Railway media pack into the Drill shape used by DrillsView / DrillDetail / DrillStep. */
export function mediaPackToDrill(pack: DrillMediaPack): Drill {
  const firstVideo = pack.steps.find((s) => s.videoUri)?.videoUri ?? null
  return {
    slug: pack.id,
    level: 'beginner',
    minutes: Math.max(1, pack.steps.length * 2),
    focus: pack.focusParts ?? [],
    videoUrl: firstVideo,
    title: pack.name,
    summary: pack.subtitle,
    focusLabel: pack.shotLabel,
    steps: pack.steps.map((s) => {
      const keyPoints: { title: string; text: string; icon: DrillKeyPointIcon }[] = [
        { title: 'Your task', text: s.task, icon: 'target' },
        ...s.focus.map((text, i) => ({
          title: i === 0 ? 'Focus on' : `Focus ${i + 1}`,
          text,
          icon: 'eye' as const,
        })),
        { title: 'Practice', text: `${s.practice} · ${s.minutes}`, icon: 'split' },
      ]
      return { title: s.title, subtitle: s.summary, keyPoints }
    }),
  }
}

/** Suggested drills for this shot when Railway media packs exist; empty → use the API catalogue. */
export function drillsFromMediaPacks(
  shotLabel: string | null | undefined,
  strokePreset?: string | null
): Drill[] {
  return mediaPacksForShot(shotLabel, strokePreset).map(mediaPackToDrill)
}
