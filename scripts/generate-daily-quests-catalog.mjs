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
    uploud3volleyshots: 'upload-3-volley-shots',
    uploudafullvideo: 'upload-a-full-video',
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

const GOAL_OVERRIDES = {
  'complete-3-before-midday': 3,
  'complete-3-daily-quests': 3,
  'upload-3-volley-shots': 3,
  'get-streak-50-points': 3,
  'upload-3-consecutive-days': 3,
  'maintain-5-day-streak': 5,
  'maintain-7-day-streak': 7,
  'complete-perfect-week': 7,
}

/** XP + cadence — keep in sync with `server/src/gamification/definitions.ts`. */
const XP_BY_KEY = {
  'first-login-of-day': 15,
  'login-to-app': 20,
  'share-your-profile': 20,
  'complete-3-before-midday': 25,
  'complete-3-daily-quests': 30,
  'complete-an-upload': 35,
  'watch-ai-replay': 35,
  'get-over-70-score': 40,
  'share-result': 45,
  'improve-ai-score-yesterday': 50,
  'upload-1-backhand': 50,
  'get-ai-score-above-80': 55,
  'score-above-60-serves': 55,
  'complete-1-ai-analysis': 60,
  'upload-3-volley-shots': 180,
  'upload-a-full-video': 200,
  'hit-perfect-bandejas': 220,
  'get-streak-50-points': 250,
  'invite-a-friend': 280,
  'get-80-above-smashes': 280,
  'get-perfect-volleys': 300,
  'upload-analyze-full-video': 320,
  'upload-3-consecutive-days': 350,
  'complete-all-daily-quests': 380,
  'achieve-s-rank-ai': 900,
  'improve-shot-accuracy-15': 1100,
  'maintain-5-day-streak': 1300,
  'maintain-7-day-streak': 1600,
  'complete-perfect-week': 1900,
  'reach-new-division': 2400,
}

const CADENCE_BY_KEY = {
  'first-login-of-day': 'daily',
  'login-to-app': 'daily',
  'share-your-profile': 'daily',
  'complete-3-before-midday': 'daily',
  'complete-3-daily-quests': 'daily',
  'complete-an-upload': 'daily',
  'watch-ai-replay': 'daily',
  'get-over-70-score': 'daily',
  'share-result': 'daily',
  'improve-ai-score-yesterday': 'daily',
  'upload-1-backhand': 'daily',
  'get-ai-score-above-80': 'daily',
  'score-above-60-serves': 'daily',
  'complete-1-ai-analysis': 'daily',
  'upload-3-volley-shots': 'weekly',
  'upload-a-full-video': 'weekly',
  'hit-perfect-bandejas': 'weekly',
  'get-streak-50-points': 'weekly',
  'invite-a-friend': 'weekly',
  'get-80-above-smashes': 'weekly',
  'get-perfect-volleys': 'weekly',
  'upload-analyze-full-video': 'weekly',
  'upload-3-consecutive-days': 'weekly',
  'complete-all-daily-quests': 'weekly',
  'achieve-s-rank-ai': 'season',
  'improve-shot-accuracy-15': 'season',
  'maintain-5-day-streak': 'season',
  'maintain-7-day-streak': 'season',
  'complete-perfect-week': 'season',
  'reach-new-division': 'season',
}

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
  'upload-3-consecutive-days': 'Upload for 3 Consecutive Days',
  'upload-3-volley-shots': 'Upload 3 Volley Shots',
  'upload-a-full-video': 'Upload a Full Video',
  'upload-analyze-full-video': 'Upload and Analyze a Full Video',
  'watch-ai-replay': 'Watch AI Replay',
}

function stemFromFilename(filename) {
  return filename.split(LS)[0].replace(/\.svg$/i, '')
}

function keyFromFile(filename) {
  const stem = stemFromFilename(filename)
  if (TITLE_OVERRIDES[stem]) return stem
  return toKey(stem)
}

/** Rename legacy SVGs (with U+2028 in the name) to stable ASCII `{key}.svg` for Metro. */
const quests = files
  .map((f) => {
    const key = keyFromFile(f)
    const xp = XP_BY_KEY[key] ?? parseXp(f)
    const safeName = `${key}.svg`
    const srcPath = path.join(dir, f)
    const destPath = path.join(dir, safeName)
    if (f !== safeName && f.includes(LS)) {
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(srcPath)
      } else {
        fs.renameSync(srcPath, destPath)
      }
      console.log('Renamed', f, '->', safeName)
    }
    return {
      key,
      xp,
      cadence: CADENCE_BY_KEY[key] ?? 'daily',
      safeName,
      titleKey: `progress.dailyQuest_${key.replace(/-/g, '_')}`,
      goal: GOAL_OVERRIDES[key] ?? 1,
    }
  })
  .filter((q) => TITLE_OVERRIDES[q.key])
  .sort((a, b) => a.key.localeCompare(b.key))

const seenKeys = new Set()
const uniqueQuests = quests.filter((q) => {
  if (seenKeys.has(q.key)) return false
  seenKeys.add(q.key)
  return true
})

const i18nEn = uniqueQuests
  .map((q) => {
    const title = TITLE_OVERRIDES[q.key] ?? q.key
    return `    dailyQuest_${q.key.replace(/-/g, '_')}: "${title}",`
  })
  .join('\n')

const body = `/** Auto-generated from app/assets/dailyquests — run: node scripts/generate-daily-quests-catalog.mjs */
import type { ImageSourcePropType } from 'react-native'

export type QuestCadence = 'daily' | 'weekly' | 'season'

export const DAILY_QUESTS_PER_DAY = 4
export const WEEKLY_QUESTS_PER_WEEK = 3
export const SEASON_QUESTS_PER_SEASON = 2

export { QUEST_XP_BADGE } from './dailyQuestXpBadge'

export type DailyQuestDef = {
  key: string
  icon: ImageSourcePropType
  titleKey: string
  xp: number
  goal: number
  cadence: QuestCadence
}

export const ALL_QUESTS: DailyQuestDef[] = [
${uniqueQuests
  .map(
    (q) => `  {
    key: '${q.key}',
    icon: require('../../assets/dailyquests/${q.safeName}'),
    titleKey: '${q.titleKey}',
    xp: ${q.xp},
    goal: ${q.goal},
    cadence: '${q.cadence}',
  },`
  )
  .join('\n')}
]

/** @deprecated Use ALL_QUESTS */
export const ALL_DAILY_QUESTS = ALL_QUESTS

const DAILY_POOL = ALL_QUESTS.filter((q) => q.cadence === 'daily')
const WEEKLY_POOL = ALL_QUESTS.filter((q) => q.cadence === 'weekly')
const SEASON_POOL = ALL_QUESTS.filter((q) => q.cadence === 'season')

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return \`\${y}-\${m}-\${day}\`
}

/** ISO week (Monday start), e.g. W2026-23 */
export function weeklyPeriodKey(d = new Date()): string {
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return \`W\${utc.getUTCFullYear()}-\${String(week).padStart(2, '0')}\`
}

/** Four-month seasons: Jan–Apr, May–Aug, Sep–Dec */
export function seasonPeriodKey(d = new Date()): string {
  const season = Math.floor(d.getMonth() / 4) + 1
  return \`S\${d.getFullYear()}-\${season}\`
}

export function periodKeyForCadence(cadence: QuestCadence, d = new Date()): string {
  if (cadence === 'weekly') return weeklyPeriodKey(d)
  if (cadence === 'season') return seasonPeriodKey(d)
  return localDateKey(d)
}

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pickFromPool(pool: DailyQuestDef[], periodKey: string, count: number): DailyQuestDef[] {
  const copy = [...pool]
  let seed = hashString(periodKey)
  for (let i = copy.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const j = seed % (i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, Math.min(count, copy.length))
}

export function pickDailyQuestsForDate(dateKey: string, count = DAILY_QUESTS_PER_DAY): DailyQuestDef[] {
  return pickFromPool(DAILY_POOL, dateKey, count)
}

export function pickWeeklyQuestsForPeriod(periodKey = weeklyPeriodKey(), count = WEEKLY_QUESTS_PER_WEEK): DailyQuestDef[] {
  return pickFromPool(WEEKLY_POOL, periodKey, count)
}

export function pickSeasonQuestsForPeriod(periodKey = seasonPeriodKey(), count = SEASON_QUESTS_PER_SEASON): DailyQuestDef[] {
  return pickFromPool(SEASON_POOL, periodKey, count)
}

export function getTodaysDailyQuests(now = new Date()): DailyQuestDef[] {
  return pickDailyQuestsForDate(localDateKey(now))
}

export function getThisWeeksQuests(now = new Date()): DailyQuestDef[] {
  return pickWeeklyQuestsForPeriod(weeklyPeriodKey(now))
}

export function getThisSeasonQuests(now = new Date()): DailyQuestDef[] {
  return pickSeasonQuestsForPeriod(seasonPeriodKey(now))
}
`

fs.writeFileSync(out, body)
console.log('Wrote', out, 'with', uniqueQuests.length, 'quests')
console.log('Add i18n keys under progress:')
console.log(i18nEn)
