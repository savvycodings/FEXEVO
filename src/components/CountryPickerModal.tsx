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
import {
  getCountriesForPicker,
  countryMatchesSearchQuery,
  type Country,
} from "../lib/countries";

const MODAL_FIELD_BG = "#0B1F57";
const MODAL_FIELD_BORDER = "rgba(21, 102, 196, 0.45)";
const LABEL_COLOR = "rgba(134, 167, 210, 0.85)";

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

  const results = useMemo(() => {
    const list = getCountriesForPicker();
    const q = String(search ?? "").trim().toLowerCase();
    if (!q) return [...list];
    return [...list].filter((c) => countryMatchesSearchQuery(c, q));
  }, [search]);

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
              placeholderTextColor={LABEL_COLOR}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>
          <FlatList
            data={results}
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
                  style={[styles.row, isSelected && styles.rowActive]}
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
                  {isSelected ? <Ionicons name="checkmark" size={18} color="#18C0FF" /> : null}
                </TouchableOpacity>
              );
            }}
          />
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
      backgroundColor: MODAL_FIELD_BG,
      borderRadius: 16,
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
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    rowActive: {
      backgroundColor: "rgba(0, 184, 255, 0.08)",
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
