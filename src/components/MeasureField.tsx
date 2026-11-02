import React, { useContext, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemeContext } from "../context";

/** Same look as the Profile Edit fields (Personal Data / Location). */
const FIELD_BG = "#041641";
const FIELD_BORDER_FOCUS = "rgba(143, 184, 255, 0.9)";
const LABEL_COLOR = "#86A7D2";
const CHEVRON_COLOR = "rgba(200, 220, 255, 0.85)";

export type MeasureInput = {
  value: string;
  onChangeText: (value: string) => void;
  /** Unit written right after the number ("cm", "ft", "in", "kg", "lb"). */
  suffix: string;
  placeholder?: string;
  testID?: string;
  maxLength?: number;
  keyboardType?: KeyboardTypeOptions;
  /** Fixed input width; omit to let a single input grow. */
  width?: number;
};

export type MeasureUnitOption<U extends string> = { value: U; label: string; testID?: string };

/**
 * Full-width field with a small label, one or two number inputs (each followed by its unit),
 * and a unit dropdown on the right that opens a small picker.
 */
export function MeasureField<U extends string>({
  label,
  inputs,
  unit,
  unitOptions,
  onUnitChange,
  unitPickerTitle,
  unitTestID,
  closeLabel,
}: {
  label: string;
  inputs: MeasureInput[];
  unit: U;
  unitOptions: MeasureUnitOption<U>[];
  onUnitChange: (unit: U) => void;
  unitPickerTitle: string;
  unitTestID?: string;
  closeLabel?: string;
}) {
  const { theme } = useContext(ThemeContext);
  const styles = getStyles(theme);
  const [focused, setFocused] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const firstInputRef = useRef<TextInput | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Measured text widths, so a growing input keeps its unit right after the number. */
  const [textWidths, setTextWidths] = useState<Record<number, number>>({});
  const unitLabel = unitOptions.find((o) => o.value === unit)?.label ?? unit;

  // Moving focus between the ft and in inputs blurs one before focusing the other; a short
  // delay keeps the border from flickering off in between.
  const onFocus = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setFocused(true);
  };
  const onBlur = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => setFocused(false), 60);
  };

  return (
    <Pressable
      style={[styles.box, (focused || pickerOpen) && styles.boxFocused]}
      onPress={() => firstInputRef.current?.focus()}
    >
      <View style={styles.body}>
        <Text allowFontScaling={false} style={styles.label}>
          {label}
        </Text>
        <View style={styles.valueRow}>
          {inputs.map((input, i) => (
            <View key={i} style={[styles.inputGroup, input.width == null && styles.inputGroupGrow]}>
              <TextInput
                ref={i === 0 ? firstInputRef : undefined}
                allowFontScaling={false}
                value={input.value}
                onChangeText={input.onChangeText}
                onFocus={onFocus}
                onBlur={onBlur}
                placeholder={input.placeholder}
                placeholderTextColor={LABEL_COLOR}
                keyboardType={input.keyboardType ?? "decimal-pad"}
                maxLength={input.maxLength}
                testID={input.testID}
                style={[
                  styles.input,
                  { width: input.width ?? Math.max(12, Math.ceil(textWidths[i] ?? 0) + 2) },
                ]}
              />
              {input.width == null ? (
                // Hidden copy of the text, measured to size the input to its content.
                <Text
                  allowFontScaling={false}
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[styles.input, styles.measure]}
                  onLayout={(e) => {
                    const w = e.nativeEvent.layout.width;
                    setTextWidths((prev) => (prev[i] === w ? prev : { ...prev, [i]: w }));
                  }}
                >
                  {input.value || input.placeholder || ""}
                </Text>
              ) : null}
              <Text allowFontScaling={false} style={styles.suffix}>
                {input.suffix}
              </Text>
            </View>
          ))}
          <View style={styles.spacer} />
        </View>
      </View>
      <TouchableOpacity
        style={styles.unitButton}
        onPress={() => setPickerOpen(true)}
        activeOpacity={0.85}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={unitPickerTitle}
        testID={unitTestID}
      >
        <Text allowFontScaling={false} style={styles.unitText}>
          {unitLabel}
        </Text>
        <Ionicons name="chevron-down" size={20} color={CHEVRON_COLOR} />
      </TouchableOpacity>

      <Modal visible={pickerOpen} animationType="fade" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerOpen(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{unitPickerTitle}</Text>
              <TouchableOpacity
                onPress={() => setPickerOpen(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={closeLabel}
              >
                <Ionicons name="close" size={22} color={LABEL_COLOR} />
              </TouchableOpacity>
            </View>
            {unitOptions.map((opt) => {
              const selected = opt.value === unit;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.row, selected && styles.rowActive]}
                  onPress={() => {
                    setPickerOpen(false);
                    if (!selected) onUnitChange(opt.value);
                  }}
                  activeOpacity={0.85}
                  testID={opt.testID}
                >
                  <Text style={[styles.rowText, selected && styles.rowTextActive]}>{opt.label}</Text>
                  {selected ? <Ionicons name="checkmark" size={18} color="#18C0FF" /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </Pressable>
  );
}

function getStyles(theme: any) {
  return StyleSheet.create({
    box: {
      width: "100%",
      height: 60,
      borderRadius: 16,
      backgroundColor: FIELD_BG,
      borderWidth: 1,
      borderColor: "transparent",
      paddingLeft: 12,
      paddingRight: 8,
      paddingVertical: 5,
      marginBottom: 6,
      flexDirection: "row",
      alignItems: "center",
    },
    boxFocused: {
      borderColor: FIELD_BORDER_FOCUS,
    },
    body: {
      flex: 1,
      minWidth: 0,
      justifyContent: "center",
    },
    label: {
      color: LABEL_COLOR,
      fontFamily: theme.mediumFont,
      fontSize: 12,
      lineHeight: 14,
      marginBottom: 2,
    },
    valueRow: {
      flexDirection: "row",
      alignItems: "center",
      height: 22,
      gap: 12,
    },
    inputGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    inputGroupGrow: {
      flexShrink: 1,
    },
    input: {
      color: "#FFFFFF",
      fontFamily: theme.regularFont,
      fontSize: 17,
      padding: 0,
      margin: 0,
      height: 22,
      ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null),
    },
    measure: {
      position: "absolute",
      opacity: 0,
      left: 0,
      top: 0,
      width: undefined,
    },
    suffix: {
      color: "#FFFFFF",
      fontFamily: theme.regularFont,
      fontSize: 17,
    },
    spacer: {
      flex: 1,
    },
    unitButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 8,
      height: "100%",
    },
    unitText: {
      color: LABEL_COLOR,
      fontFamily: theme.regularFont,
      fontSize: 17,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(1, 7, 25, 0.78)",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    modalCard: {
      backgroundColor: FIELD_BG,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: FIELD_BORDER_FOCUS,
      paddingTop: 12,
      paddingBottom: 8,
      overflow: "hidden",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingBottom: 10,
    },
    modalTitle: {
      color: "#FFFFFF",
      fontFamily: theme.semiBoldFont,
      fontSize: 17,
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
    rowText: {
      flex: 1,
      color: "#FFFFFF",
      fontFamily: theme.regularFont,
      fontSize: 17,
    },
    rowTextActive: {
      fontFamily: theme.semiBoldFont,
    },
  });
}
