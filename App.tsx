import './global.css';
import 'react-native-gesture-handler'
import { useState, useEffect, useRef, useCallback, useContext } from 'react'
import { DarkTheme, NavigationContainer, type Theme as NavigationTheme } from '@react-navigation/native'
import { Main } from './src/main'
import { useFonts } from 'expo-font'
import {
  Inter_100Thin,
  Inter_200ExtraLight,
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter'
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
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { KeyboardProvider } from 'react-native-keyboard-controller'

LogBox.ignoreLogs([
  'Key "cancelled" in the image picker result is deprecated and will be removed in SDK 48, use "canceled" instead',
  'No native splash screen registered'
])

/** RN Navigation defaults use a light background; override so transitions don’t flash white. */
const APP_NAV_BG = '#030A17'
const navigationTheme: NavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: APP_NAV_BG,
    card: APP_NAV_BG,
    border: 'transparent',
  },
}

export default function App() {
  const [theme, setTheme] = useState<string>('vercel')
  const [chatType, setChatType] = useState<Model>(MODELS.gpt5Mini)
  const [imageModel, setImageModel] = useState<string>(IMAGE_MODELS.nanoBanana.label)
  const [modalVisible, setModalVisible] = useState<boolean>(false)
  const [fontsLoaded] = useFonts({
    Inter_100Thin,
    Inter_200ExtraLight,
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
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
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: APP_NAV_BG }}>
      <KeyboardProvider preload={false}>
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
      </KeyboardProvider>
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
  const name = theme == null || theme === '' ? 'vercel' : String(theme)
  let current: (typeof themes)['vercel'] | undefined
  for (const key of Object.keys(themes)) {
    if (key.includes(name)) {
      current = (themes as Record<string, typeof themes.vercel>)[key]
    }
  }
  return current ?? themes.vercel
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

  if (!session) {
    return (
      <SafeAreaProvider>
        <NavigationContainer theme={navigationTheme}>
          <Onboarding />
        </NavigationContainer>
      </SafeAreaProvider>
    )
  }

  if (!profileComplete) {
    return (
      <SafeAreaProvider>
        <NavigationContainer theme={navigationTheme}>
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
        <NavigationContainer theme={navigationTheme}>
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
      <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.centerContent}>
          <Text allowFontScaling={false} style={styles.title}>
            {title}
          </Text>
          <Text allowFontScaling={false} style={styles.subtitle}>
            {subtitle}
          </Text>
        </View>
      </SafeAreaView>
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
