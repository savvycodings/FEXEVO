import './global.css';
import 'react-native-gesture-handler'
import { useState, useEffect, useRef, useCallback, useContext } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { Main } from './src/main'
import { useFonts } from 'expo-font'
import { ThemeContext, AppContext } from './src/context'
import * as themes from './src/theme'
import { IMAGE_MODELS, MODELS } from './constants'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ChatModelModal } from './src/components/index'
import { Model } from './types'
import { ActionSheetProvider } from '@expo/react-native-action-sheet'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
} from '@gorhom/bottom-sheet'
import { StyleSheet, LogBox, View, Text } from 'react-native'
import { authClient } from './src/lib/auth-client'
import { Onboarding } from './src/screens'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Header } from './src/components'

LogBox.ignoreLogs([
  'Key "cancelled" in the image picker result is deprecated and will be removed in SDK 48, use "canceled" instead',
  'No native splash screen registered'
])

export default function App() {
  const [theme, setTheme] = useState<string>('vercel')
  const [chatType, setChatType] = useState<Model>(MODELS.gpt5Mini)
  const [imageModel, setImageModel] = useState<string>(IMAGE_MODELS.nanoBanana.label)
  const [modalVisible, setModalVisible] = useState<boolean>(false)
    const [fontsLoaded] = useFonts({
    'Geist-Regular': require('./assets/fonts/Geist-Regular.otf'),
    'Geist-Light': require('./assets/fonts/Geist-Light.otf'),
    'Geist-Bold': require('./assets/fonts/Geist-Bold.otf'),
    'Geist-Medium': require('./assets/fonts/Geist-Medium.otf'),
    'Geist-Black': require('./assets/fonts/Geist-Black.otf'),
    'Geist-SemiBold': require('./assets/fonts/Geist-SemiBold.otf'),
    'Geist-Thin': require('./assets/fonts/Geist-Thin.otf'),
    'Geist-UltraLight': require('./assets/fonts/Geist-UltraLight.otf'),
    'Geist-UltraBlack': require('./assets/fonts/Geist-UltraBlack.otf')
  })

  useEffect(() => {
    configureStorage()
  }, [])

  async function configureStorage() {
    try {
      const _theme = await AsyncStorage.getItem('rnai-theme')
      if (_theme) setTheme(_theme)
      const _chatType = await AsyncStorage.getItem('rnai-chatType')
      if (_chatType) setChatType(JSON.parse(_chatType))
      const _imageModel = await AsyncStorage.getItem('rnai-imageModel')
      if (_imageModel) setImageModel(_imageModel)
    } catch (err) {
      console.log('error configuring storage', err)
    }
  }

  const bottomSheetModalRef = useRef<BottomSheetModal>(null)
  function closeModal() {
    bottomSheetModalRef.current?.dismiss()
    setModalVisible(false)
  }

  function handlePresentModalPress() {
    if (modalVisible) {
      closeModal()
    } else {
      bottomSheetModalRef.current?.present()
      setModalVisible(true)
    }
  }

  function _setChatType(type) {
    setChatType(type)
    AsyncStorage.setItem('rnai-chatType', JSON.stringify(type))
  }

  function _setImageModel(model) {
    setImageModel(model)
    AsyncStorage.setItem('rnai-imageModel', model)
  }

  function _setTheme(theme) {
    setTheme(theme)
    AsyncStorage.setItem('rnai-theme', theme)
  }

  const bottomSheetStyles = getBottomsheetStyles(getTheme(theme))

  if (!fontsLoaded) return null
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeContext.Provider value={{
        theme: getTheme(theme),
        themeName: theme,
        setTheme: _setTheme
      }}>
        <AuthGate
          bottomSheetModalRef={bottomSheetModalRef}
          bottomSheetStyles={bottomSheetStyles}
          setModalVisible={setModalVisible}
          modalVisible={modalVisible}
          chatType={chatType}
          _setChatType={_setChatType}
          handlePresentModalPress={handlePresentModalPress}
          imageModel={imageModel}
          _setImageModel={_setImageModel}
          closeModal={closeModal}
        />
      </ThemeContext.Provider>
    </GestureHandlerRootView>
  )
}

const getBottomsheetStyles = theme => StyleSheet.create({
  background: {
    paddingHorizontal: 24,
    backgroundColor: theme.backgroundColor
  },
  handle: {
    marginHorizontal: 15,
    backgroundColor: theme.backgroundColor,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: 'rgba(255, 255, 255, .3)'
  }
})

function getTheme(theme: any) {
  let current
  Object.keys(themes).forEach(_theme => {
    if (_theme.includes(theme)) {
      current = themes[_theme]
    }
  })
  return current
}

function AuthGate(props: {
  bottomSheetModalRef: React.RefObject<BottomSheetModal | null>
  bottomSheetStyles: { handleIndicator: object; handle: object; background: object }
  setModalVisible: (v: boolean) => void
  modalVisible: boolean
  chatType: Model
  _setChatType: (t: Model) => void
  handlePresentModalPress: () => void
  imageModel: string
  _setImageModel: (m: string) => void
  closeModal: () => void
}) {
  const { theme } = useContext(ThemeContext)
  const { data: session, isPending } = authClient.useSession()
  const [profileChecked, setProfileChecked] = useState(false)
  const [profileComplete, setProfileComplete] = useState(false)

  const checkProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setProfileChecked(false)
      setProfileComplete(false)
      return
    }
    setProfileChecked(false)
    let isComplete = false
    // Avoid "bounce-back" race right after final setup save.
    // On some runs, session appears before profile row is fully visible.
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await authClient.$fetch('/profile/me', { method: 'GET' }).catch(() => null)
      const body: any = (res as any)?.data ?? res
      if (body?.isComplete) {
        isComplete = true
        break
      }
      if (attempt < 4) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }
    setProfileComplete(isComplete)
    setProfileChecked(true)
  }, [session?.user?.id])

  useEffect(() => {
    void checkProfile()
  }, [checkProfile])

  if (session && (isPending || !profileChecked)) {
    return (
      <AuthLoadingScreen
        theme={theme}
        title="Finalizing your account"
        subtitle="Syncing your profile and preparing your Technique workspace."
      />
    )
  }

  // If not signed in, show onboarding stack (Sign In / Sign Up)
  if (!session) {
    return (
      <SafeAreaProvider>
        <NavigationContainer>
          <Onboarding initialRouteName="SignIn" />
        </NavigationContainer>
      </SafeAreaProvider>
    )
  }

  if (!profileComplete) {
    return (
      <SafeAreaProvider>
        <NavigationContainer>
          <Onboarding
            initialRouteName="ProfileSetup"
            onProfileSetupComplete={() => {
              setProfileComplete(true)
              setProfileChecked(true)
            }}
          />
        </NavigationContainer>
      </SafeAreaProvider>
    )
  }

  // Signed in: show main app + model picker
  return (
    <AppContext.Provider
      value={{
        chatType: props.chatType,
        setChatType: props._setChatType as any,
        handlePresentModalPress: props.handlePresentModalPress,
        imageModel: props.imageModel,
        setImageModel: props._setImageModel as any,
        closeModal: props.closeModal,
      }}
    >
      <ActionSheetProvider>
        <NavigationContainer>
          <Main />
        </NavigationContainer>
      </ActionSheetProvider>
      <BottomSheetModalProvider>
        <BottomSheetModal
          handleIndicatorStyle={props.bottomSheetStyles.handleIndicator}
          handleStyle={props.bottomSheetStyles.handle}
          backgroundStyle={props.bottomSheetStyles.background}
          ref={props.bottomSheetModalRef}
          enableDynamicSizing={true}
          backdropComponent={(p) => <BottomSheetBackdrop {...p} disappearsOnIndex={-1} />}
          enableDismissOnClose
          enablePanDownToClose
          onDismiss={() => props.setModalVisible(false)}
        >
          <BottomSheetView>
            <ChatModelModal handlePresentModalPress={props.handlePresentModalPress} />
          </BottomSheetView>
        </BottomSheetModal>
      </BottomSheetModalProvider>
    </AppContext.Provider>
  )
}

function AuthLoadingScreen({
  theme,
  title,
  subtitle,
}: {
  theme: any
  title: string
  subtitle: string
}) {
  const styles = getAuthLoadingStyles(theme)
  return (
    <SafeAreaProvider>
      <View style={styles.screen}>
        <Header />
        <View style={styles.centerContent}>
          <Text allowFontScaling={false} style={styles.title}>
            {title}
          </Text>
          <Text allowFontScaling={false} style={styles.subtitle}>
            {subtitle}
          </Text>
        </View>
      </View>
    </SafeAreaProvider>
  )
}

const getAuthLoadingStyles = (theme: any) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.backgroundColor,
    },
    centerContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      gap: 12,
    },
    title: {
      color: '#FFFFFF',
      fontFamily: theme.semiBoldFont,
      fontSize: 18,
      textAlign: 'center',
    },
    subtitle: {
      color: 'rgba(255,255,255,0.74)',
      fontFamily: theme.regularFont,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
      maxWidth: 320,
    },
  })

