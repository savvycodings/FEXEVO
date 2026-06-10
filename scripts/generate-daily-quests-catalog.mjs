import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dir = path.join(__dirname, '../assets/dailyquests')
const out = path.join(__dirname, '../src/lib/dailyQuestsCatalog.ts')
const LS = '\u2028'

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.svg'))

function toKey(base) {
  const map = {
    AchieveSrankinAIanalysis: 'achieve-s-rank-ai',
    Complete1AIanalysis: 'complete-1-ai-analysis',
    Complete3dailyquestsinoneday: 'complete-3-daily-quests',
    Complete3questsbeforemidday: 'complete-3-before-midday',
    CompleteALLdailyquests: 'complete-all-daily-quests',
    Completeaperfectweek: 'complete-perfect-week',
    Completeauploud: 'complete-an-upload',
    Firstloginoftheday: 'first-login-of-day',
    get80aboveforsmashes: 'get-80-above-smashes',
    GetanAIscoreabove80: 'get-ai-score-above-80',
    Getaperfectvolleys: 'get-perfect-volleys',
    Getastreakof50points: 'get-streak-50-points',
    getover70score: 'get-over-70-score',
    Hit1perfectbandejas: 'hit-perfect-bandejas',
    Improveshotaccuracyby15: 'improve-shot-accuracy-15',
    ImproveyourAIscorecomparedtoyesterday: 'improve-ai-score-yesterday',
    Inviteafriend: 'invite-a-friend',
    Logintotheapp: 'login-to-app',
    'Maintaina5-daystreak': 'maintain-5-day-streak',
    'Maintaina7-daystreak': 'maintain-7-day-streak',
    Reachanewdivisionranking: 'reach-new-division',
    scoreabove60forserves: 'score-above-60-serves',
    Shareresult: 'share-result',
    Shareyourprofile: 'share-your-profile',
    Uploadandanalyzeafullvideo: 'upload-analyze-full-video',
    uploadfor3consecutivedays: 'upload-3-consecutive-days',
    uploud1backhandshot: 'upload-1-backhand',
    uploud1forehandshots: 'upload-1-forehand',
    uploud3volleyshots: 'upload-3-volley-shots',
    uploudafullvideo: 'upload-a-full-video',
    uploudasuccessfulserve: 'upload-successful-serve',
    WatchAIreplay: 'watch-ai-replay',
  }
  const clean = base.replace(/%/g, '')
  if (map[clean]) return map[clean]
  return clean
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
}

function parseXp(f) {
  const m = f.match(/\+(\d+)\s*XP/i)
  return m ? parseInt(m[1], 10) : 0
}

function toLabelKey(key) {
  return key
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
    .replace(/^./, (c) => c.toLowerCase())
}

const quests = files
  .map((f) => {
    const base = f.split(LS)[0]
    const key = toKey(base)
    const xp = parseXp(f)
    const escaped = f.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    const labelSuffix = toLabelKey(key)
    return { key, xp, escaped, labelSuffix, titleKey: `progress.dailyQuest_${key.replace(/-/g, '_')}` }
  })
  .sort((a, b) => a.key.localeCompare(b.key))

const TITLE_OVERRIDES = {
  'achieve-s-rank-ai': 'Achieve S Rank in AI',
  'complete-1-ai-analysis': 'Complete 1 AI Analysis',
  'complete-3-before-midday': 'Complete 3 Quests Before Midday',
  'complete-3-daily-quests': 'Complete 3 Daily Quests in One Day',
  'complete-all-daily-quests': 'Complete All Daily Quests',
  'complete-an-upload': 'Complete an Upload',
  'complete-perfect-week': 'Complete a Perfect Week',
  'first-login-of-day': 'First Login of the Day',
  'get-80-above-smashes': 'Get 80+ on Smashes',
  'get-ai-score-above-80': 'Get AI Score Above 80',
  'get-over-70-score': 'Get Over 70 Score',
  'get-perfect-volleys': 'Get Perfect Volleys',
  'get-streak-50-points': 'Get a 50-Point Streak',
  'hit-perfect-bandejas': 'Hit 1 Perfect Bandeja',
  'improve-ai-score-yesterday': 'Improve AI Score vs Yesterday',
  'improve-shot-accuracy-15': 'Improve Shot Accuracy by 15%',
  'invite-a-friend': 'Invite a Friend',
  'login-to-app': 'Log in to the App',
  'maintain-5-day-streak': 'Maintain a 5-Day Streak',
  'maintain-7-day-streak': 'Maintain a 7-Day Streak',
  'reach-new-division': 'Reach a New Division Ranking',
  'score-above-60-serves': 'Score Above 60 on Serves',
  'share-result': 'Share a Result',
  'share-your-profile': 'Share Your Profile',
  'upload-1-backhand': 'Upload 1 Backhand Shot',
  'upload-1-forehand': 'Upload 1 Forehand Shot',
  'upload-3-consecutive-days': 'Upload for 3 Consecutive Days',
  'upload-3-volley-shots': 'Upload 3 Volley Shots',
  'upload-a-full-video': 'Upload a Full Video',
  'upload-analyze-full-video': 'Upload and Analyze a Full Video',
  'upload-successful-serve': 'Upload a Successful Serve',
  'watch-ai-replay': 'Watch AI Replay',
}

const i18nEn = quests
  .map((q) => {
    const title = TITLE_OVERRIDES[q.key] ?? q.key
    return `    dailyQuest_${q.key.replace(/-/g, '_')}: "${title}",`
  })
  .join('\n')

const body = `/** Auto-generated from app/assets/dailyquests — run: node scripts/generate-daily-quests-catalog.mjs */
import type { ImageSourcePropType } from 'react-native'

export const DAILY_QUESTS_PER_DAY = 4

export const QUEST_XP_BADGE = require('../../assets/dailyquests/blueXP.png') as number

export type DailyQuestDef = {
  key: string
  icon: ImageSourcePropType
  titleKey: string
  xp: number
  goal: number
}

export const ALL_DAILY_QUESTS: DailyQuestDef[] = [
${quests
  .map(
    (q) => `  {
    key: '${q.key}',
    icon: require('../../assets/dailyquests/${q.escaped}'),
    titleKey: '${q.titleKey}',
    xp: ${q.xp},
    goal: 1,
  },`
  )
  .join('\n')}
]

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return \`\${y}-\${m}-\${day}\`
}

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Same 4 quests for everyone on a given calendar day; changes at local midnight. */
export function pickDailyQuestsForDate(dateKey: string, count = DAILY_QUESTS_PER_DAY): DailyQuestDef[] {
  const pool = [...ALL_DAILY_QUESTS]
  let seed = hashString(dateKey)
  for (let i = pool.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const j = seed % (i + 1)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.min(count, pool.length))
}

export function getTodaysDailyQuests(now = new Date()): DailyQuestDef[] {
  return pickDailyQuestsForDate(localDateKey(now))
}
`

fs.writeFileSync(out, body)
console.log('Wrote', out, 'with', quests.length, 'quests')
console.log('Add i18n keys under progress:')
console.log(i18nEn)
