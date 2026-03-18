import { useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Technique } from './screens'
import { Header } from './components'
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'
import { ThemeContext } from './context'

function MainComponent() {
  const insets = useSafeAreaInsets()
  const { theme } = useContext(ThemeContext)
  const [techniqueResetKey, setTechniqueResetKey] = useState(0)
  const styles = getStyles({ theme, insets })
  
  return (
    <View style={styles.container}>
      <Header onLogoPress={() => setTechniqueResetKey(prev => prev + 1)} />
      <Technique key={techniqueResetKey} />
    </View>
  );
}

export function Main() {
  return (
    <SafeAreaProvider>
      <MainComponent />
    </SafeAreaProvider>
  )
}

const getStyles = ({ theme, insets } : { theme: any, insets: any}) => StyleSheet.create({
  container: {
    backgroundColor: theme.backgroundColor,
    flex: 1,
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  },
})
