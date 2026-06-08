/** Stored on server / DB — keep English literals; UI uses i18n keys. */
export const LEVEL_OPTION_VALUES = [
  "Beginner",
  "High Beginner",
  "Low Intermediate",
  "Intermediate",
  "High Intermediate",
  "Low Advanced",
  "Advanced",
  "High Advanced",
  "Competition/Open",
  "Other",
] as const;

export type LevelOptionValue = (typeof LEVEL_OPTION_VALUES)[number];

const LEVEL_VALUE_TO_KEY: Record<LevelOptionValue, string> = {
  Beginner: "levels.beginner",
  "High Beginner": "levels.highBeginner",
  "Low Intermediate": "levels.lowIntermediate",
  Intermediate: "levels.intermediate",
  "High Intermediate": "levels.highIntermediate",
  "Low Advanced": "levels.lowAdvanced",
  Advanced: "levels.advanced",
  "High Advanced": "levels.highAdvanced",
  "Competition/Open": "levels.competition",
  Other: "levels.other",
};

export function levelTranslationKey(value: string): string {
  return LEVEL_VALUE_TO_KEY[value as LevelOptionValue] ?? "levels.other";
}

export const GENDER_OPTION_VALUES = [
  "Male",
  "Female",
  "Other",
  "Prefer not to say",
] as const;

const GENDER_VALUE_TO_KEY: Record<string, string> = {
  Male: "gender.male",
  Female: "gender.female",
  Other: "gender.other",
  "Prefer not to say": "gender.preferNot",
};

export function genderTranslationKey(value: string): string {
  return GENDER_VALUE_TO_KEY[value] ?? value;
}
