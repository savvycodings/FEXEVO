import { CommonActions } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { MainStackParamList } from '../navigation/types'

type Nav = NativeStackNavigationProp<MainStackParamList>

/**
 * Open Activities → shot detail for a saved technique analysis.
 * Resets the root stack so we do not `goBack` from Notifications (that caused GO_BACK errors).
 */
export function navigateToActivityAnalysis(navigation: Nav, analysisId: string) {
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [
        {
          name: 'Main',
          params: {
            screen: 'Activities',
            params: { openAnalysisId: analysisId },
          },
        },
      ],
    })
  )
}
