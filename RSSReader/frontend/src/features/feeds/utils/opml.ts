import type { FeedSummary, OpmlImportResult } from "../../../../../shared/feed";

export function buildFeedsOpmlExport(feeds: FeedSummary[]) {
  if (feeds.length === 0) {
    throw new Error("No feeds to export.");
  }

  const now = new Date().toUTCString();
  const outlines = feeds
    .map((feed) => {
      const title = escapeXml(feed.title);
      const xmlUrl = escapeXml(feed.url);
      const htmlUrl = escapeXml(feed.siteUrl ?? feed.url);
      return `    <outline text="${title}" title="${title}" type="rss" xmlUrl="${xmlUrl}" htmlUrl="${htmlUrl}" />`;
    })
    .join("\n");

  const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Vortex subscriptions</title>
    <dateCreated>${escapeXml(now)}</dateCreated>
  </head>
  <body>
${outlines}
  </body>
</opml>
`;

  return {
    content: opml,
    defaultFileName: `vortex-subscriptions-${new Date().toISOString().slice(0, 10)}.opml`,
  };
}

export function formatOpmlImportResult(result: OpmlImportResult) {
  if (result.total === 0) {
    return "OPML import found no feed URLs.";
  }

  const parts = [`Imported ${result.imported}/${result.total} feeds`];
  if (result.skipped > 0) {
    parts.push(`${result.skipped} skipped`);
  }
  if (result.failed > 0) {
    parts.push(`${result.failed} failed`);
  }
  if (result.backgroundRefreshStarted) {
    parts.push("articles syncing in background");
  }

  return `${parts.join(", ")}.`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
