export function getReaderSelectedText(container: HTMLElement | null): string {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !container) {
    return "";
  }

  const range = selection.getRangeAt(0);
  if (
    range.collapsed ||
    (!container.contains(range.commonAncestorContainer) &&
      !container.contains(selection.anchorNode) &&
      !container.contains(selection.focusNode))
  ) {
    return "";
  }

  return selection.toString().replace(/\s+/g, " ").trim();
}
