import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  strongDelimiter: "**",
});

turndown.addRule("table", {
  filter: ["table"],
  replacement: (_content, node) => (node as HTMLElement).outerHTML,
});

turndown.addRule("image", {
  filter: ["img"],
  replacement: (_content, node) => (node as HTMLElement).outerHTML,
});

turndown.addRule("paragraph", {
  filter: ["p"],
  replacement: (_content, node) => (node as HTMLElement).outerHTML + "\n",
});

export function normalizeMarkdown(html: string): string {
  const prepared = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const md = turndown.turndown(prepared);
  const unescaped = md.replace(/\\([*])/g, "$1");
  return unescaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export function markdownForCopy(md: string): string {
  return md.replace(/<strong>/g, "**").replace(/<\/strong>/g, "**");
}
