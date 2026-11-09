import { File, Paths } from 'expo-file-system'

/** Survives leaving Smart 3D mid-download so reopen does not start from scratch. */
const inflight = new Map<string, Promise<string>>()

function fileNameFor(remote: string): string {
  return remote.split('/').pop()?.split('?')[0] || 'orbit.mp4'
}

/** Download an orbit mp4 once per URL; later callers share the same promise/file. */
export function cacheOrbitVideo(remote: string): Promise<string> {
  const existing = inflight.get(remote)
  if (existing) return existing
  const next = (async () => {
    const file = await File.downloadFileAsync(
      remote,
      new File(Paths.document, fileNameFor(remote)),
      { idempotent: true }
    )
    return file.uri
  })().catch((err) => {
    inflight.delete(remote)
    throw err
  })
  inflight.set(remote, next)
  return next
}

/** Kick a download without awaiting — used while hologram polling finds a new clip. */
export function prefetchOrbitVideo(remote: string | null | undefined): void {
  if (!remote) return
  void cacheOrbitVideo(remote).catch(() => {})
}
