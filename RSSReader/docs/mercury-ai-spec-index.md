# Mercury AI 规格索引（RSSReader 移植）

> 来源：[neolee/mercury](https://github.com/neolee/mercury)  
> 用途：实现与验收对照，**不拷贝 Swift 源码**。

## 已迁入 RSSReader

| Mercury 资产 | RSSReader 路径 | 状态 |
|--------------|----------------|------|
| `Resources/Agent/Prompts/*.yaml` | `resources/Agent/Prompts/` | 四份内置 Prompt 正文已对齐 |
| `docs/agent-prompts.md` | `backend/src/ai/prompt/*` | 条件段、自定义回退、无 executor 改 prompt |
| `docs/features/summary-agent.md` | `summary/service.rs` | 非流式摘要 + 持久化（Mercury 为 SSE，后续 AI-07） |
| `docs/features/tags-v2.md` normalize | `tagging/normalize.rs` + `assign_tag` | 写入门控 + 手动 assign |
| `docs/features/translate-agent.md` 分段 | `translation/segmentation.rs` | p/ul/ol 提取 |
| `translation.hy-mt` 策略 | `translation.hy-mt.yaml` + `PromptResolver` | `hy_mt_optimized` 设置项 |
| OpenAI-compatible | `client/openai_compat.rs` | `ping` + `chat_completion` |
| Keychain / Secrets | `backend/src/ai/secrets.rs` | `keyring` 存 OS 凭据；自动迁移遗留 `.key` 明文 |

## 规格文档 → Issue

| Mercury 文档 | Issue | 说明 |
|--------------|-------|------|
| `docs/agent-prompts.md` | AI-03 | Prompt 治理 |
| `docs/features/summary-agent.md` | AI-07/08 | SSE 与 SummaryPanel 待做 |
| `docs/features/translate-agent.md` | AI-09/10 | 按段执行与 UI |
| `docs/features/tags-v2.md` | AI-11/12 | 建议 UI；无 NLTagger/批量 |
| `docs/features/token-usage.md` | AI-13/14 | `llm_usage_events` 写入待做 |

## 明确不移植

- 自动摘要（拉取时）
- NLTagger / 批量打标签
- 费用估算

## Prompt 字段映射

| Mercury YAML | RSSReader YAML |
|--------------|----------------|
| `systemTemplate` | `system_template` |
| `template` | `user_template` |
| `version: vN` | `version: N` |
| `defaultParameters` | `default_parameters`（`key=value` 列表） |

自定义模板目录：`%APPDATA%/RSSReader/Agent/Prompts/`（或 `RSSREADER_DATA_DIR`）。
