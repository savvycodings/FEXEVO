import type { NavigationProp, ParamListBase } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MainStackParamList } from '../navigation/types'

type NavLike = {
  getParent: () => NavigationProp<ParamListBase> | undefined
  getState: () => { routeNames?: string[] }
}

/** Walk parent navigators until we find the authenticated root stack (CoachAddPeople, etc.). */
export function getMainStackNavigation(
  navigation: NavLike
): NativeStackNavigationProp<MainStackParamList> | undefined {
  let current: NavigationProp<ParamListBase> | undefined = navigation as NavigationProp<ParamListBase>
  for (let depth = 0; depth < 8 && current; depth++) {
    const names = current.getState()?.routeNames ?? []
    if (names.includes('CoachAddPeople')) {
      return current as NativeStackNavigationProp<MainStackParamList>
    }
    current = current.getParent()
  }
  return undefined
}
