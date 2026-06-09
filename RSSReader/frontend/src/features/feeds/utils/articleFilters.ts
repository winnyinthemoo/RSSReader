import type { ArticleListFilter } from "../../../../../shared/feed";
import type { SidebarSelection } from "../types";

export function filterFromSelection(selection: SidebarSelection): ArticleListFilter {
  switch (selection.type) {
    case "feed":
      return { feedId: selection.feedId };
    case "starred":
      return { favoritesOnly: true };
    case "tag":
      return { tagIds: selection.tagIds, tagMatch: selection.tagMatch };
    case "all":
    default:
      return {};
  }
}

export function buildArticleFilter(
  selection: SidebarSelection,
  searchQuery = "",
): ArticleListFilter {
  const filter = filterFromSelection(selection);
  const normalizedSearchQuery = searchQuery.trim();
  if (!normalizedSearchQuery) {
    return filter;
  }

  return { ...filter, searchQuery: normalizedSearchQuery };
}
