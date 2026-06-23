import { Platform } from 'react-native'
import {
  createUploadTask,
  FileSystemUploadType,
} from 'expo-file-system/legacy'
import {
  getTechniqueUploadAuthHeaders,
  resolveStableVideoUriForUpload,
} from './techniqueVideoUpload'

export type CoachSentVideoFields = {
  studentUserId: string
  category?: string | null
  strokePreset?: string | null
  shotLabel?: string | null
  skillLevel?: string | null
  viewId?: string | null
  note?: string | null
}

export type CoachSentVideoResult = {
  sentVideoId: string
}

type ResponseBody = {
  ok?: boolean
  sentVideoId?: string
  error?: string
}

function parseBody(text: string): ResponseBody {
  try {
    return JSON.parse(text) as ResponseBody
  } catch {
    return { error: 'Invalid server response' }
  }
}

function buildParameters(fields: CoachSentVideoFields): Record<string, string> {
  const out: Record<string, string> = { studentUserId: fields.studentUserId }
  const opt: Array<[keyof CoachSentVideoFields, string]> = [
    ['category', 'category'],
    ['strokePreset', 'strokePreset'],
    ['shotLabel', 'shotLabel'],
    ['skillLevel', 'skillLevel'],
    ['viewId', 'viewId'],
    ['note', 'note'],
  ]
  for (const [key, param] of opt) {
    const value = fields[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      out[param] = value.trim()
    }
  }
  return out
}

export async function uploadCoachSentVideo(opts: {
  uri: string
  fileName: string
  mimeType: string
  apiBase: string
  fields: CoachSentVideoFields
  onProgress?: (percent: number) => void
}): Promise<CoachSentVideoResult> {
  const { uri, fileName, mimeType, apiBase, fields, onProgress } = opts
  const uploadUrl = `${apiBase.replace(/\/+$/, '')}/coach/sent-video`
  const parameters = buildParameters(fields)

  onProgress?.(2)

  if (Platform.OS === 'web') {
    const res = await fetch(uri)
    const blob = await res.blob()
    const file = new File([blob], fileName, { type: mimeType })
    const formData = new FormData()
    formData.append('video', file)
    for (const [k, v] of Object.entries(parameters)) formData.append(k, v)
    const body: ResponseBody = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', uploadUrl)
      xhr.withCredentials = true
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && evt.total > 0) {
          onProgress?.(Math.min(95, Math.round((evt.loaded / evt.total) * 95)))
        }
      }
      xhr.onload = () => {
        const parsed = parseBody(xhr.responseText ?? '')
        if (xhr.status >= 200 && xhr.status < 300) resolve(parsed)
        else reject(new Error(parsed.error || `Upload failed (${xhr.status})`))
      }
      xhr.onerror = () => reject(new Error('Upload failed due to a network error'))
      xhr.send(formData)
    })
    onProgress?.(100)
    if (!body.sentVideoId) {
      throw new Error(body.error || 'Upload failed. Please try again.')
    }
    return { sentVideoId: body.sentVideoId }
  }

  const uploadUri = await resolveStableVideoUriForUpload(uri)
  const headers = await getTechniqueUploadAuthHeaders()
  const task = createUploadTask(
    uploadUrl,
    uploadUri,
    {
      uploadType: FileSystemUploadType.MULTIPART,
      fieldName: 'video',
      mimeType,
      parameters,
      headers,
    },
    (data) => {
      const expected = data.totalBytesExpectedToSend
      if (expected > 0) {
        onProgress?.(
          Math.min(95, Math.round((data.totalBytesSent / expected) * 95))
        )
      }
    }
  )

  const result = await task.uploadAsync()
  if (!result) throw new Error('Upload failed')
  const body = parseBody(result.body ?? '')
  if (result.status < 200 || result.status >= 300 || !body.sentVideoId) {
    throw new Error(body.error || `Upload failed (${result.status})`)
  }
  onProgress?.(100)
  return { sentVideoId: body.sentVideoId }
}
