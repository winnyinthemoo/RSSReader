# 2026-06-09 AI Provider List Scroll

- Date: 2026-06-09
- Owner: frontend
- Tool: Codex
- Issue / PR: not linked
- Goal: Make the Providers panel in Model Settings scroll independently.
- Prompt summary: User asked to add sliding/scroll behavior to the boxed Providers area.
- Changes: Wrapped provider items in `ai-list-scroll`, kept the header fixed, added independent scrolling, subtle Apple-style scrollbar, fade mask, responsive behavior, and visible slide-in motion for the Providers card and its contents.
- Manual check: Pending browser visual review by frontend owner.
- Tests: Ran `npm --prefix frontend run build`; build passed with the existing Vite chunk-size warning.
- Open issues: No functional issue found. Visual tuning can continue after testing with many providers.
