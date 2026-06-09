import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'coach_pinned_student_ids_v1'

export async function loadPinnedStudentIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
  } catch {
    return []
  }
}

export async function savePinnedStudentIds(ids: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    /* ignore write errors */
  }
}

export function pinStudentId(ids: string[], studentId: string): string[] {
  const next = ids.filter((id) => id !== studentId)
  return [studentId, ...next]
}

export function unpinStudentId(ids: string[], studentId: string): string[] {
  return ids.filter((id) => id !== studentId)
}

export function sortStudentsWithPins<T extends { id: string }>(students: T[], pinnedIds: string[]): T[] {
  const pinIndex = new Map(pinnedIds.map((id, i) => [id, i]))
  return students
    .map((student, index) => ({ student, index }))
    .sort((a, b) => {
      const aPin = pinIndex.has(a.student.id) ? pinIndex.get(a.student.id)! : Number.POSITIVE_INFINITY
      const bPin = pinIndex.has(b.student.id) ? pinIndex.get(b.student.id)! : Number.POSITIVE_INFINITY
      if (aPin !== bPin) return aPin - bPin
      return a.index - b.index
    })
    .map(({ student }) => student)
}
