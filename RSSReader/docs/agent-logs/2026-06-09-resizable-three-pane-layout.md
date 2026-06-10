# 2026-06-09 Resizable Three Pane Layout

- Date: 2026-06-09
- Owner: frontend
- Tool: Codex
- Issue / PR: not linked
- Goal: Allow users to manually resize the three-pane reader layout.
- Prompt summary: User asked to manually adjust the spacing between the three columns.
- Changes: Added draggable pane resizers between Feed / Article List / Reader panes, persisted pane widths in localStorage, and added Apple-style hover/drag affordances.
- Manual check: Pending browser visual review by frontend owner.
- Tests: Ran `npm --prefix frontend run build`; build passed with the existing Vite chunk-size warning.
- Open issues: Further tuning can adjust min/max pane widths after team feedback.
