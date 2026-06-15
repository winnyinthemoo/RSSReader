import type { AppLanguage } from "../../../i18n";
import { formatClockTime as formatLocalizedClockTime, getAppText } from "../../../i18n";

export function formatFeedSyncStatus(
  feedCount: number,
  failedCount: number,
  completedAt: Date,
  language: AppLanguage,
) {
  return getAppText(language).app.feedSyncStatus(feedCount, failedCount, completedAt);
}

export function formatFeedSyncToast(
  feedCount: number,
  failedCount: number,
  newArticleCount: number,
  reason: string,
  language: AppLanguage,
) {
  return getAppText(language).app.feedSyncToast(feedCount, failedCount, newArticleCount, reason);
}

export function formatSyncInterval(minutes: number) {
  return minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`;
}

export function formatClockTime(date: Date, language: AppLanguage) {
  return formatLocalizedClockTime(date, language);
}
