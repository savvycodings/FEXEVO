import React, { useContext, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Pressable,
  Image,
  useWindowDimensions,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { ThemeContext } from "../context";
import { TEST_IDS } from '../lib/testIds'
import { glow } from "../screens/progress/progressTheme";
import {
  getCountriesForPicker,
  countryMatchesSearchQuery,
  type Country,
} from "../lib/countries";

const MODAL_FIELD_BORDER = "rgba(21, 102, 196, 0.45)";
const LABEL_COLOR = "rgba(134, 167, 210, 0.85)";
/** Fixed row pitch (height + gap) so the A–Z index can jump with getItemLayout. */
const ROW_H = 52;
const ROW_GAP = 4;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** First letter of a country name, accents removed (Åland → A). */
function initialOf(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
}

type CountryPickerModalProps = {
  visible: boolean;
  selected: Country | null;
  onSelect: (country: Country) => void;
  onClose: () => void;
};

export function CountryPickerModal({
  visible,
  selected,
  onSelect,
  onClose,
}: CountryPickerModalProps) {
  const { t } = useTranslation();
  const { theme } = useContext(ThemeContext);
  const { height: winH } = useWindowDimensions();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [search, setSearch] = React.useState("");
  const [listH, setListH] = React.useState(0);
  const listRef = React.useRef<FlatList<Country>>(null);

  const results = useMemo(() => {
    const list = getCountriesForPicker();
    const q = String(search ?? "").trim().toLowerCase();
    if (!q) return [...list];
    return [...list].filter((c) => countryMatchesSearchQuery(c, q));
  }, [search]);

  const firstIndexByLetter = useMemo(() => {
    const map = new Map<string, number>();
    results.forEach((c, i) => {
      const letter = initialOf(c.name);
      if (!map.has(letter)) map.set(letter, i);
    });
    return map;
  }, [results]);

  // Shrink the letters on short screens so all 26 fit beside the list.
  const letterH = listH > 0 ? Math.min(18, (listH - 8) / LETTERS.length) : 14;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { maxHeight: winH * 0.78 }]}>
          <View style={styles.header}>
            <Text allowFontScaling={false} style={styles.title}>
              {t("profileSettingsUi.selectCountry")}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button">
              <Ionicons name="close" size={22} color={LABEL_COLOR} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color="rgba(200, 220, 255, 0.65)" style={{ marginRight: 8 }} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("profileSettingsUi.searchCountry")}
              testID={TEST_IDS.countrySearch}
              placeholderTextColor={LABEL_COLOR}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>
          <View style={styles.listArea} onLayout={(e) => setListH(e.nativeEvent.layout.height)}>
          <FlatList
            ref={listRef}
            data={results}
            getItemLayout={(_, index) => ({ length: ROW_H, offset: ROW_H * index, index })}
            contentContainerStyle={styles.listContent}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            maxToRenderPerBatch={30}
            windowSize={11}
            ListEmptyComponent={
              <Text allowFontScaling={false} style={styles.emptyText}>
                No countries match &quot;{search}&quot;.
              </Text>
            }
            renderItem={({ item }) => {
              const isSelected = selected?.code === item.code;
              return (
                <TouchableOpacity
                  style={[styles.row, isSelected && styles.rowActive, isSelected && glow(10, 0.6)]}
                  testID={TEST_IDS.countryOption(item.code)}
                  onPress={() => {
                    onSelect(item);
                    setSearch("");
                    onClose();
                  }}
                  activeOpacity={0.85}
                >
                  <Image source={item.flag} style={styles.rowFlag} />
                  <Text
                    allowFontScaling={false}
                    style={[styles.rowText, isSelected && styles.rowTextActive]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {isSelected ? <Ionicons name="checkmark-circle" size={22} color="#18C0FF" /> : null}
                </TouchableOpacity>
              );
            }}
          />
          <View style={styles.index} pointerEvents="box-none">
            {LETTERS.map((letter) => {
              const target = firstIndexByLetter.get(letter);
              const enabled = target != null;
              return (
                <TouchableOpacity
                  key={letter}
                  disabled={!enabled}
                  onPress={() => {
                    if (target != null) listRef.current?.scrollToIndex({ index: target, animated: false });
                  }}
                  style={[styles.indexItem, { height: letterH }]}
                  testID={`country-index-${letter}`}
                  accessibilityRole="button"
                  accessibilityLabel={letter}
                  accessibilityState={{ disabled: !enabled }}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.indexText,
                      { fontSize: Math.min(12, letterH - 2) },
                      !enabled && styles.indexTextOff,
                    ]}
                  >
                    {letter}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function getStyles(theme: { regularFont: string; semiBoldFont: string }) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(1, 7, 25, 0.78)",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    card: {
      backgroundColor: "#06143D",
      borderRadius: 24,
      borderWidth: 1,
      borderColor: MODAL_FIELD_BORDER,
      paddingTop: 12,
      paddingBottom: 8,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingBottom: 10,
    },
    title: {
      color: "#FFFFFF",
      fontFamily: theme.semiBoldFont,
      fontSize: 17,
    },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#041641",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: MODAL_FIELD_BORDER,
      paddingHorizontal: 12,
      marginHorizontal: 12,
      marginBottom: 8,
      minHeight: 48,
    },
    searchInput: {
      flex: 1,
      color: "#FFFFFF",
      fontFamily: theme.regularFont,
      fontSize: 17,
      paddingVertical: Platform.OS === "ios" ? 12 : 10,
    },
    listArea: {
      flexShrink: 1,
      minHeight: 0,
    },
    listContent: {
      paddingLeft: 12,
      paddingRight: 34,
      paddingBottom: 8,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      height: ROW_H - ROW_GAP,
      marginBottom: ROW_GAP,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: "transparent",
    },
    rowActive: {
      backgroundColor: "#0B2A6B",
      borderColor: "#3D8BFF",
    },
    index: {
      position: "absolute",
      top: 4,
      right: 6,
      width: 22,
      alignItems: "center",
    },
    indexItem: {
      width: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    indexText: {
      color: "#18C0FF",
      fontFamily: theme.semiBoldFont,
    },
    indexTextOff: {
      color: "rgba(134, 167, 210, 0.3)",
    },
    rowFlag: {
      width: 28,
      height: 20,
      borderRadius: 3,
      backgroundColor: "rgba(255,255,255,0.06)",
    },
    rowText: {
      flex: 1,
      color: "#FFFFFF",
      fontFamily: theme.regularFont,
      fontSize: 17,
    },
    rowTextActive: {
      fontFamily: theme.semiBoldFont,
    },
    emptyText: {
      color: LABEL_COLOR,
      fontFamily: theme.regularFont,
      fontSize: 15,
      textAlign: "center",
      paddingVertical: 24,
      paddingHorizontal: 16,
    },
  });
}
