# Resources

Static templates and assets not compiled into binaries.

## Agent Prompts

| File | Agent |
|------|-------|
| `Agent/Prompts/summary.default.yaml` | Summary |
| `Agent/Prompts/translation.default.yaml` | Translation (standard) |
| `Agent/Prompts/translation.hy-mt.yaml` | Translation (HY-MT optimized) |
| `Agent/Prompts/tagging.default.yaml` | Tagging |

User overrides are copied to the app data directory on first "custom prompts" action.

Built-in bodies are ported from [Mercury](https://github.com/neolee/mercury) `Resources/Agent/Prompts/` (RSSReader field names: `system_template`, `user_template`).
