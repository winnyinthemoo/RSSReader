import type { SidebarSelection } from "../types";

export function reconcileSelectionAfterTagRemoval(
  selection: SidebarSelection,
  removedTagId: string,
): SidebarSelection {
  if (selection.type !== "tag") {
    return selection;
  }

  const nextTagIds = selection.tagIds.filter((tagId) => tagId !== removedTagId);
  if (nextTagIds.length === 0) {
    return { type: "all" };
  }

  return { ...selection, tagIds: nextTagIds };
}

export function reconcileSelectionAfterTagMerge(
  selection: SidebarSelection,
  sourceTagId: string,
  targetTagId: string,
): SidebarSelection {
  if (selection.type !== "tag") {
    return selection;
  }

  if (!selection.tagIds.includes(sourceTagId) && !selection.tagIds.includes(targetTagId)) {
    return selection;
  }

  const nextTagIds = Array.from(
    new Set(selection.tagIds.map((tagId) => (tagId === sourceTagId ? targetTagId : tagId))),
  );
  if (nextTagIds.length === 0) {
    return { type: "all" };
  }

  return { ...selection, tagIds: nextTagIds };
}

export function upsertFeed<T extends { id: string }>(feeds: T[], nextFeed: T) {
  const existingIndex = feeds.findIndex((feed) => feed.id === nextFeed.id);
  if (existingIndex === -1) {
    return [...feeds, nextFeed];
  }

  return feeds.map((feed) => (feed.id === nextFeed.id ? nextFeed : feed));
}
