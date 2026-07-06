import { authClient } from './auth-client'
import { clearCachedProfile } from './profile-cache'

export async function signOutAndClearProfileCache(): Promise<void> {
  await clearCachedProfile()
  await authClient.signOut()
}
