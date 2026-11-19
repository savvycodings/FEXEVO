import { DOMAIN } from '../../../constants'

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
}

function drillsMediaUrl(shot: string, file: string): string {
  // Prefer explicit drills host, then app DOMAIN, then production BEXEVO
  // (drills are served from Railway even when the app API points at ngrok).
  const base = (
    process.env.EXPO_PUBLIC_DRILLS_MEDIA_BASE_URL ||
    DOMAIN ||
    'https://bexevo-production.up.railway.app'
  ).replace(/\/$/, '')
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

const DRILLS: Record<string, DrillMediaPack> = {
  'bandeja-drill': {
    id: 'bandeja-drill',
    name: 'Bandeja Drill',
    shotLabel: 'Bandeja',
    subtitle: 'Build a more consistent bandeja with the right preparation and contact.',
    steps: BANDEJA_STEPS,
  },
  'overhead-positioning': {
    id: 'overhead-positioning',
    name: 'Overhead Positioning',
    shotLabel: 'Overhead',
    subtitle: 'Improve your overhead position and spacing.',
    steps: OVERHEAD_STEPS,
  },
  'recovery-balance': {
    id: 'recovery-balance',
    name: 'Recovery & Balance',
    shotLabel: 'Recovery',
    subtitle: 'Recover after the overhead and get ready for the next shot.',
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

export function getDrillMediaPack(drillId: string | null | undefined): DrillMediaPack {
  if (drillId && DRILLS[drillId]) return DRILLS[drillId]
  return DRILLS['bandeja-drill']
}
