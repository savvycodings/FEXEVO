import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Height and weight are always stored in cm and kg (rounded to 0.1). The unit a player sees
 * (cm or ft-in, kg or lb) is a per-device display choice: switching it only re-renders the
 * canonical value, so flipping back and forth never drifts.
 */
export type HeightUnit = "cm" | "ftin";
export type WeightUnit = "kg" | "lb";
export type BodyUnits = { height: HeightUnit; weight: WeightUnit };

export const BODY_UNITS_STORAGE_KEY = "xevo_body_units";
export const DEFAULT_BODY_UNITS: BodyUnits = { height: "cm", weight: "kg" };

/** Same ranges the backend enforces (parseRequiredHeightCm / parseRequiredWeightKg). */
export const HEIGHT_RANGE_CM = { min: 100, max: 250 } as const;
export const WEIGHT_RANGE_KG = { min: 30, max: 250 } as const;

const CM_PER_IN = 2.54;
const KG_PER_LB = 0.45359237;

/** Storage rounding: one decimal place. */
export function roundTenth(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Display: whole inches, split into feet + inches. */
export function cmToFtIn(cm: number): { ft: number; inches: number } {
  const total = Math.round(cm / CM_PER_IN);
  return { ft: Math.floor(total / 12), inches: total % 12 };
}

/** Feet + inches typed by the player → stored cm. */
export function ftInToCm(ft: number, inches: number): number {
  return roundTenth((ft * 12 + inches) * CM_PER_IN);
}

/** Display: whole pounds. */
export function kgToLb(kg: number): number {
  return Math.round(kg / KG_PER_LB);
}

/** Pounds typed by the player → stored kg. */
export function lbToKg(lb: number): number {
  return roundTenth(lb * KG_PER_LB);
}

/** "170" for 170, "170.2" for 170.18: one decimal only when it isn't zero. */
export function formatTenth(n: number): string {
  const r = roundTenth(n);
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Parses "84.5" or "84,5"; empty or garbage → null. */
export function parseDecimalInput(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function formatFtIn(ft: number, inches: number): string {
  return `${ft} ft ${inches} in`;
}

export function isHeightCmValid(cm: number | null): cm is number {
  return cm != null && cm >= HEIGHT_RANGE_CM.min && cm <= HEIGHT_RANGE_CM.max;
}

export function isWeightKgValid(kg: number | null): kg is number {
  return kg != null && kg >= WEIGHT_RANGE_KG.min && kg <= WEIGHT_RANGE_KG.max;
}

/**
 * Allowed height range as labels in the given unit. For ft-in the bounds are rounded inward to
 * whole inches, so every value inside the shown range is valid (3 ft 4 in – 8 ft 2 in).
 */
export function heightRangeLabels(unit: HeightUnit): { min: string; max: string } {
  if (unit === "cm") {
    return { min: `${HEIGHT_RANGE_CM.min} cm`, max: `${HEIGHT_RANGE_CM.max} cm` };
  }
  const minIn = Math.ceil(HEIGHT_RANGE_CM.min / CM_PER_IN);
  const maxIn = Math.floor(HEIGHT_RANGE_CM.max / CM_PER_IN);
  return {
    min: formatFtIn(Math.floor(minIn / 12), minIn % 12),
    max: formatFtIn(Math.floor(maxIn / 12), maxIn % 12),
  };
}

/** Allowed weight range as labels; lb bounds are rounded inward (67 – 551 lb). */
export function weightRangeLabels(unit: WeightUnit): { min: string; max: string } {
  if (unit === "kg") {
    return { min: `${WEIGHT_RANGE_KG.min} kg`, max: `${WEIGHT_RANGE_KG.max} kg` };
  }
  return {
    min: `${Math.ceil(WEIGHT_RANGE_KG.min / KG_PER_LB)} lb`,
    max: `${Math.floor(WEIGHT_RANGE_KG.max / KG_PER_LB)} lb`,
  };
}

export async function getBodyUnits(): Promise<BodyUnits> {
  try {
    const raw = await AsyncStorage.getItem(BODY_UNITS_STORAGE_KEY);
    if (!raw) return DEFAULT_BODY_UNITS;
    const parsed = JSON.parse(raw) as Partial<BodyUnits>;
    return {
      height: parsed.height === "ftin" ? "ftin" : "cm",
      weight: parsed.weight === "lb" ? "lb" : "kg",
    };
  } catch {
    return DEFAULT_BODY_UNITS;
  }
}

export async function setBodyUnits(units: BodyUnits): Promise<void> {
  try {
    await AsyncStorage.setItem(BODY_UNITS_STORAGE_KEY, JSON.stringify(units));
  } catch {
    /* ignore */
  }
}
