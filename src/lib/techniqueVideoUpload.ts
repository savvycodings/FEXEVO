import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import * as Linking from 'expo-linking'
import Constants from 'expo-constants'
import * as FileSystem from 'expo-file-system/legacy'
import {
  createUploadTask,
  FileSystemUploadType,
} from 'expo-file-system/legacy'

const AUTH_STORAGE_PREFIX = 'xevo'
const AUTH_COOKIE_KEY = `${AUTH_STORAGE_PREFIX}_cookie`

const PREPARE_END = 12
const UPLOAD_START = 12
const UPLOAD_END = 92
const FINISH_END = 100

export type TechniqueUploadResult = {
  id: string
  url?: string
  /** Stable `file://` URI used for upload on native (for carousel thumbnails). */
  localUri?: string
}

function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function mapPrepareProgress(fraction: number): number {
  return clampPercent(fraction * PREPARE_END)
}

function mapUploadBytesProgress(loaded: number, total: number): number {
  if (total > 0 && Number.isFinite(loaded) && Number.isFinite(total)) {
    const ratio = Math.max(0, Math.min(1, loaded / total))
    return clampPercent(UPLOAD_START + ratio * (UPLOAD_END - UPLOAD_START))
  }
  return UPLOAD_START
}

function mapFinishProgress(): number {
  return FINISH_END
}

function parseCookieHeader(cookieJson: string | null): string {
  if (!cookieJson) return ''
  let parsed: Record<string, { value?: string; expires?: string | null }> = {}
  try {
    parsed = JSON.parse(cookieJson) as typeof parsed
  } catch {
    return ''
  }
  const now = Date.now()
  return Object.entries(parsed)
    .filter(([, v]) => {
      if (!v?.value) return false
      if (v.expires && new Date(v.expires).getTime() <= now) return false
      return true
    })
    .map(([key, v]) => `${key}=${v!.value}`)
    .join('; ')
}

function getExpoOriginHeader(): string {
  const rawScheme = Constants.expoConfig?.scheme ?? Constants.platform?.scheme
  const scheme = Array.isArray(rawScheme) ? rawScheme[0] : rawScheme
  if (!scheme || Platform.OS === 'web') return ''
  return Linking.createURL('', { scheme })
}

export async function getTechniqueUploadAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'x-skip-oauth-proxy': 'true',
  }
  if (Platform.OS === 'web') {
    return headers
  }
  const cookieJson = await SecureStore.getItemAsync(AUTH_COOKIE_KEY)
  const cookie = parseCookieHeader(cookieJson)
  if (cookie) headers.cookie = cookie
  const origin = getExpoOriginHeader()
  if (origin) headers['expo-origin'] = origin
  return headers
}

export async function resolveStableVideoUriForUpload(uri: string): Promise<string> {
  if (Platform.OS === 'web' || uri.startsWith('file://')) return uri
  const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory
  if (!base) return uri
  const dest = `${base}technique-upload-${Date.now()}.mp4`
  await FileSystem.copyAsync({ from: uri, to: dest })
  return dest.startsWith('file://') ? dest : `file://${dest}`
}

type UploadResponseBody = {
  id?: string
  url?: string
  error?: string
}

function parseUploadResponseBody(text: string): UploadResponseBody {
  try {
    return JSON.parse(text) as UploadResponseBody
  } catch {
    return { error: 'Invalid server response' }
  }
}

function uploadViaXhr(
  url: string,
  formData: FormData,
  onProgress: (percent: number) => void
): Promise<UploadResponseBody> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.withCredentials = true

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && evt.total > 0) {
        onProgress(mapUploadBytesProgress(evt.loaded, evt.total))
      }
    }

    xhr.onload = () => {
      const text = xhr.responseText ?? ''
      const body = parseUploadResponseBody(text)
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body)
        return
      }
      reject(new Error(body.error || `Upload failed (${xhr.status})`))
    }

    xhr.onerror = () => reject(new Error('Upload failed due to a network error'))
    xhr.onabort = () => reject(new Error('Upload cancelled'))

    onProgress(UPLOAD_START)
    xhr.send(formData)
  })
}

async function uploadViaFileSystem(
  url: string,
  fileUri: string,
  fileName: string,
  mimeType: string,
  sendVideoToCoach: boolean,
  headers: Record<string, string>,
  onProgress: (percent: number) => void
): Promise<UploadResponseBody> {
  let lastMapped = UPLOAD_START
  const task = createUploadTask(
    url,
    fileUri,
    {
      uploadType: FileSystemUploadType.MULTIPART,
      fieldName: 'video',
      mimeType,
      parameters: { sendVideoToCoach: sendVideoToCoach ? '1' : '0' },
      headers,
    },
    (data) => {
      const sent = data.totalBytesSent
      const expected = data.totalBytesExpectedToSend
      if (expected > 0) {
        lastMapped = mapUploadBytesProgress(sent, expected)
        onProgress(lastMapped)
      } else if (sent > 0 && lastMapped < UPLOAD_END - 1) {
        lastMapped = Math.min(UPLOAD_END - 1, lastMapped + 0.5)
        onProgress(lastMapped)
      }
    }
  )

  onProgress(UPLOAD_START)
  const result = await task.uploadAsync()
  if (!result) {
    throw new Error('Upload failed')
  }
  if (result.status < 200 || result.status >= 300) {
    const body = parseUploadResponseBody(result.body ?? '')
    throw new Error(body.error || `Upload failed (${result.status})`)
  }
  return parseUploadResponseBody(result.body ?? '')
}

export async function uploadTechniqueVideo(opts: {
  uri: string
  fileName: string
  mimeType: string
  sendVideoToCoach: boolean
  apiBase: string
  onProgress: (percent: number) => void
}): Promise<TechniqueUploadResult> {
  const { fileName, mimeType, sendVideoToCoach, apiBase, onProgress } = opts
  const uploadUrl = `${apiBase.replace(/\/+$/, '')}/technique/upload`

  onProgress(0)

  let uploadUri = opts.uri
  if (Platform.OS !== 'web') {
    onProgress(mapPrepareProgress(0.2))
    uploadUri = await resolveStableVideoUriForUpload(opts.uri)
    onProgress(mapPrepareProgress(1))
  } else {
    onProgress(mapPrepareProgress(0.5))
  }

  const headers = await getTechniqueUploadAuthHeaders()

  let data: UploadResponseBody

  if (Platform.OS === 'web') {
    onProgress(mapPrepareProgress(0.85))
    const res = await fetch(opts.uri)
    const blob = await res.blob()
    const file = new File([blob], fileName, { type: mimeType })
    const formData = new FormData()
    formData.append('video', file)
    formData.append('sendVideoToCoach', sendVideoToCoach ? '1' : '0')
    onProgress(PREPARE_END)
    data = await uploadViaXhr(uploadUrl, formData, onProgress)
  } else {
    onProgress(PREPARE_END)
    data = await uploadViaFileSystem(
      uploadUrl,
      uploadUri,
      fileName,
      mimeType,
      sendVideoToCoach,
      headers,
      onProgress
    )
  }

  onProgress(UPLOAD_END)
  if (!data.id) {
    throw new Error(data.error || 'Upload failed. Please try again.')
  }

  onProgress(mapFinishProgress())
  return {
    id: data.id,
    url: data.url,
    localUri: Platform.OS !== 'web' ? uploadUri : undefined,
  }
}
