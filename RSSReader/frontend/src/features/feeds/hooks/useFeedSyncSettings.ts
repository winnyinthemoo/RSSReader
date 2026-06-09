import { useEffect, useState } from "react";

import type { FeedSyncMode } from "../types";

export interface FeedSyncSettings {
  mode: FeedSyncMode;
  intervalMinutes: number;
}

const feedSyncSettingsKey = "vortex.feedSyncSettings";
const defaultFeedSyncSettings: FeedSyncSettings = {
  mode: "manual",
  intervalMinutes: 30,
};

export function useFeedSyncSettings() {
  const [syncSettings, setSyncSettings] = useState<FeedSyncSettings>(() =>
    readFeedSyncSettings(),
  );

  useEffect(() => {
    window.localStorage.setItem(feedSyncSettingsKey, JSON.stringify(syncSettings));
  }, [syncSettings]);

  return [syncSettings, setSyncSettings] as const;
}

function readFeedSyncSettings(): FeedSyncSettings {
  try {
    const rawSettings = window.localStorage.getItem(feedSyncSettingsKey);
    if (!rawSettings) {
      return defaultFeedSyncSettings;
    }

    const parsedSettings = JSON.parse(rawSettings) as Partial<FeedSyncSettings>;
    const mode = isFeedSyncMode(parsedSettings.mode)
      ? parsedSettings.mode
      : defaultFeedSyncSettings.mode;
    const intervalMinutes =
      typeof parsedSettings.intervalMinutes === "number" &&
      [15, 30, 60, 120].includes(parsedSettings.intervalMinutes)
        ? parsedSettings.intervalMinutes
        : defaultFeedSyncSettings.intervalMinutes;

    return { mode, intervalMinutes };
  } catch {
    return defaultFeedSyncSettings;
  }
}

function isFeedSyncMode(value: unknown): value is FeedSyncMode {
  return value === "manual" || value === "launch" || value === "timer";
}
