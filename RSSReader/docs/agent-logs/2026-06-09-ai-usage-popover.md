# 2026-06-09 AI Usage Popover

- Date: 2026-06-09
- Owner: frontend
- Tool: Codex
- Issue / PR: not linked
- Goal: Move the AI usage activity card out of the main settings content and show it on demand.
- Prompt summary: User asked to make the Provider Activity area open from a small indicator in the top-right instead of always showing.
- Changes: Added a Usage button in the Model Settings header, moved `UsageSummary` into a right-aligned popover, removed inline usage cards from Providers / Models / Agents tabs, and added Apple-style popover visuals.
- Manual check: Pending browser visual review by frontend owner.
- Tests: Ran `npm --prefix frontend run build`; build passed with the existing Vite chunk-size warning.
- Open issues: Popover placement can be tuned further after browser review.
