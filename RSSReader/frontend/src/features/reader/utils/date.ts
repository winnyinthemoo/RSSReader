import type { AppLanguage } from "../../../i18n";
import { appLocale, getAppText } from "../../../i18n";

export function formatFullDate(value: string | undefined, language: AppLanguage) {
  if (!value) {
    return getAppText(language).common.noDate;
  }

  return new Intl.DateTimeFormat(appLocale(language), {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
