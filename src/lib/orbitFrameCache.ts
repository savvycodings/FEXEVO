import { Directory, File, Paths } from 'expo-file-system'

/**
 * Frames of one orbit clip saved as pictures, by frame index.
 *
 * Orbit clips have a single keyframe, so every seek decodes from the start of the clip and
 * takes a few hundred milliseconds. Swapping a saved picture takes a few, in either direction,
 * which is what lets a finger drag turn the model smoothly.
 */
export type OrbitFrameSet = {
  key: string
  /** Picture per frame of the clip; null where no picture was taken. */
  uris: (string | null)[]
  /** True once the clip has been played through to the end. */
  complete: boolean
}

/** Marks a folder whose frames cover the whole clip. */
const DONE = 'done'

const sets = new Map<string, OrbitFrameSet>()

function folder(key: string): Directory {
  return new Directory(Paths.cache, 'orbit-frames-v2', key)
}

function frameName(frame: number): string {
  return `f${frame}.jpg`
}

/** Folder name for a clip at one stage size. Pictures are stage-shaped, so the size is part of it. */
export function orbitFrameKey(clipUri: string, width: number, height: number): string {
  const name = (clipUri.split('/').pop() ?? 'orbit').split('?')[0]!.replace(/[^A-Za-z0-9._-]/g, '_')
  return `${name}-${Math.round(width)}x${Math.round(height)}`
}

/**
 * Frames saved for this clip. Reads a finished set back from disk the first time it is asked
 * for, so the clip is only played through once per install.
 */
export function orbitFrameSet(key: string, count: number): OrbitFrameSet {
  const known = sets.get(key)
  if (known && known.uris.length === count) return known
  const set: OrbitFrameSet = { key, uris: new Array<string | null>(count).fill(null), complete: false }
  try {
    const dir = folder(key)
    if (dir.exists && new File(dir, DONE).exists) {
      for (const entry of dir.list()) {
        const frame = Number(/^f(\d+)\.jpg$/.exec(entry.name)?.[1] ?? NaN)
        if (Number.isInteger(frame) && frame >= 0 && frame < count) set.uris[frame] = entry.uri
      }
      set.complete = set.uris.some(Boolean)
    } else if (dir.exists) {
      // Left half done by an earlier run. Start clean so none of its pictures are mixed in.
      dir.delete()
    }
  } catch {
    // Unreadable folder: the clip is simply played through again.
  }
  sets.set(key, set)
  return set
}

/** Moves a freshly captured picture into the set as this frame. */
export function saveOrbitFrame(set: OrbitFrameSet, frame: number, capturedUri: string): void {
  const dir = folder(set.key)
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true })
  const saved = new File(dir, frameName(frame))
  if (saved.exists) saved.delete()
  new File(capturedUri).move(saved)
  set.uris[frame] = saved.uri
}

/** The clip has been played to the end: later visits reuse these pictures. */
export function finishOrbitFrameSet(set: OrbitFrameSet): void {
  set.complete = true
  try {
    const marker = new File(folder(set.key), DONE)
    if (!marker.exists) marker.create()
  } catch {
    // Not marked: the set still works for this session and is rebuilt next time.
  }
}

/** Saved frame closest to this one, or -1 when nothing is saved yet. */
export function nearestOrbitFrame(set: OrbitFrameSet, frame: number): number {
  const last = set.uris.length - 1
  const at = Math.min(last, Math.max(0, Math.round(frame)))
  for (let d = 0; d <= last; d++) {
    if (at - d >= 0 && set.uris[at - d]) return at - d
    if (at + d <= last && set.uris[at + d]) return at + d
  }
  return -1
}
