/** i18n key for how to complete a quest — `progress.dailyQuest_{key}_desc`. */
export function getQuestDescriptionKey(questKey: string): string {
  return `progress.dailyQuest_${questKey.replace(/-/g, '_')}_desc`
}
