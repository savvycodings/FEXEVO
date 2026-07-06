import AsyncStorage from "@react-native-async-storage/async-storage";

const PROFILE_CACHE_KEY = "xevo.profile.cache.v1";

export type CachedProfile = {
  /** Session user id when cache was written — prevents cross-account role bleed. */
  userId?: string | null;
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  profile?: {
    username?: string | null;
    phone?: string | null;
    areaLocation?: string | null;
    birthDate?: string | null;
    gender?: string | null;
    level?: string | null;
    rankingOrg?: string | null;
    rankingValue?: string | null;
    /** `none` | `coach` | `student` — drives My Coach tab visibility. */
    coachStudentRole?: string | null;
  } | null;
  updatedAt: number;
};

export async function getCachedProfile(): Promise<CachedProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedProfile;
  } catch {
    return null;
  }
}

export async function setCachedProfile(profile: Omit<CachedProfile, "updatedAt">): Promise<void> {
  try {
    const payload: CachedProfile = {
      ...profile,
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(payload));
  } catch {
  }
}

export async function clearCachedProfile(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
  }
}
