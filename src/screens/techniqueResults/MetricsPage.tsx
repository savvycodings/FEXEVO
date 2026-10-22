import { useContext } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ThemeContext } from '../../context'

type Props = { visible: boolean }

export function MetricsPage({ visible }: Props) {
  const { t } = useTranslation()
  const { theme } = useContext(ThemeContext)
  return (
    <View style={visible ? styles.page : styles.hidden}>
      <Text allowFontScaling={false} style={[styles.title, { fontFamily: theme.semiBoldFont }]}>
        {t('technique.resultSections.metrics')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  hidden: { display: 'none' },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
  },
})
