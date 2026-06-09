export function formatFeedSyncStatus(feedCount: number, failedCount: number, completedAt: Date) {
  if (failedCount > 0) {
    return `${feedCount - failedCount}/${feedCount} synced`;
  }

  return `Synced ${formatClockTime(completedAt)}`;
}

export function formatFeedSyncToast(
  feedCount: number,
  failedCount: number,
  newArticleCount: number,
  reason: string,
) {
  const parts = [
    `Synced ${feedCount - failedCount}/${feedCount} feeds`,
    `${newArticleCount} new articles`,
  ];
  if (failedCount > 0) {
    parts.push(`${failedCount} failed`);
  }

  return `${parts.join(", ")} (${reason}).`;
}

export function formatSyncInterval(minutes: number) {
  return minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`;
}

export function formatClockTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
