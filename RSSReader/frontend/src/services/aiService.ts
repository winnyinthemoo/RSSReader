import type {
  AiAgentSettings,
  AiModel,
  AiModelListResult,
  AiProvider,
  AiProviderListResult,
  ArticleSummaryRecord,
  AssignTagsRequest,
  AssignTagsResult,
  CreateAiModelRequest,
  CreateAiProviderRequest,
  GetSummaryRequest,
  PromptRevealResult,
  ProviderTestRequest,
  ProviderTestResult,
  StartSummaryRequest,
  StartTranslationRequest,
  SummaryStreamChunk,
  TaggingSuggestRequest,
  TaggingSuggestResult,
  TranslationView,
  TranslationStreamChunk,
  UpdateAiModelRequest,
  UpdateAiProviderRequest,
  UsageReportResult,
} from "../../../shared/ai";

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke?: TauriInvoke;
      };
      tauri?: {
        invoke?: TauriInvoke;
      };
    };
  }
}

const backendBaseUrl = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:5181";

function getInvoke(): TauriInvoke | undefined {
  return window.__TAURI__?.core?.invoke ?? window.__TAURI__?.tauri?.invoke;
}

export async function listAiProviders(): Promise<AiProviderListResult> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<AiProviderListResult>("ai_list_providers");
  }

  return requestJson<AiProviderListResult>("/api/ai/providers");
}

export async function createAiProvider(
  request: CreateAiProviderRequest,
): Promise<AiProvider> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<AiProvider>("ai_create_provider", { request });
  }

  return requestJson<AiProvider>("/api/ai/providers", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function updateAiProvider(
  providerId: string,
  request: UpdateAiProviderRequest,
): Promise<AiProvider> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<AiProvider>("ai_update_provider", { providerId, request });
  }

  return requestJson<AiProvider>(
    `/api/ai/providers/${encodeURIComponent(providerId)}`,
    {
      method: "PUT",
      body: JSON.stringify(request),
    },
  );
}

export async function deleteAiProvider(providerId: string): Promise<void> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<void>("ai_delete_provider", { providerId });
  }

  await requestJson<{ ok: boolean }>(
    `/api/ai/providers/${encodeURIComponent(providerId)}`,
    { method: "DELETE" },
  );
}

export async function listAiModels(): Promise<AiModelListResult> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<AiModelListResult>("ai_list_models");
  }

  return requestJson<AiModelListResult>("/api/ai/models");
}

export async function createAiModel(request: CreateAiModelRequest): Promise<AiModel> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<AiModel>("ai_create_model", { request });
  }

  return requestJson<AiModel>("/api/ai/models", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function updateAiModel(
  modelId: string,
  request: UpdateAiModelRequest,
): Promise<AiModel> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<AiModel>("ai_update_model", { modelId, request });
  }

  return requestJson<AiModel>(`/api/ai/models/${encodeURIComponent(modelId)}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export async function deleteAiModel(modelId: string): Promise<void> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<void>("ai_delete_model", { modelId });
  }

  await requestJson<{ ok: boolean }>(
    `/api/ai/models/${encodeURIComponent(modelId)}`,
    { method: "DELETE" },
  );
}

export async function testAiProvider(
  request: ProviderTestRequest,
): Promise<ProviderTestResult> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<ProviderTestResult>("ai_test_provider", { request });
  }

  return requestJson<ProviderTestResult>("/api/ai/providers/test", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function getAiAgentSettings(agent: string): Promise<AiAgentSettings> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<AiAgentSettings>("ai_get_agent_settings", { agent });
  }

  return requestJson<AiAgentSettings>(`/api/ai/settings/${encodeURIComponent(agent)}`);
}

export async function updateAiAgentSettings(
  settings: AiAgentSettings,
): Promise<AiAgentSettings> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<AiAgentSettings>("ai_update_agent_settings", { settings });
  }

  return requestJson<AiAgentSettings>(
    `/api/ai/settings/${encodeURIComponent(settings.agentType)}`,
    {
      method: "PUT",
      body: JSON.stringify(settings),
    },
  );
}

export async function revealAiPrompt(agent: string): Promise<PromptRevealResult> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<PromptRevealResult>("ai_reveal_prompt", { agent });
  }

  return requestJson<PromptRevealResult>(
    `/api/ai/prompts/reveal/${encodeURIComponent(agent)}`,
    { method: "POST" },
  );
}

export async function getArticleSummary(
  request: GetSummaryRequest,
): Promise<ArticleSummaryRecord | null> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<ArticleSummaryRecord | null>("ai_get_summary", { request });
  }

  const params = new URLSearchParams({
    articleId: request.articleId,
    targetLanguage: request.targetLanguage,
    detailLevel: request.detailLevel,
  });
  return requestJson<ArticleSummaryRecord | null>(`/api/ai/summary?${params.toString()}`);
}

export async function startArticleSummary(
  request: StartSummaryRequest,
): Promise<SummaryStreamChunk> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<SummaryStreamChunk>("ai_start_summary", { request });
  }

  return requestJson<SummaryStreamChunk>("/api/ai/summary/stream", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function suggestTags(
  request: TaggingSuggestRequest,
): Promise<TaggingSuggestResult> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<TaggingSuggestResult>("ai_suggest_tags", { request });
  }

  return requestJson<TaggingSuggestResult>("/api/ai/tagging/suggest", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function assignTags(request: AssignTagsRequest): Promise<AssignTagsResult> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<AssignTagsResult>("ai_assign_tags", { request });
  }

  return requestJson<AssignTagsResult>("/api/ai/tags/assign", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function getArticleTranslation(
  articleId: string,
  targetLanguage: string,
): Promise<TranslationView | null> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<TranslationView | null>("ai_get_translation", {
      articleId,
      targetLanguage,
    });
  }

  const params = new URLSearchParams({
    articleId,
    targetLanguage,
  });
  return requestJson<TranslationView | null>(`/api/ai/translation?${params.toString()}`);
}

export async function startTranslation(
  request: StartTranslationRequest,
  onChunk?: (view: TranslationView) => void,
): Promise<TranslationView> {
  const invoke = getInvoke();
  if (invoke) {
    const result = await invoke<TranslationView>("ai_start_translation", { request });
    onChunk?.(result);
    return result;
  }

  return streamTranslationRequest(request, onChunk);
}

export async function getUsageReport(
  dimension: string,
  windowDays: number,
  key?: string,
): Promise<UsageReportResult> {
  const invoke = getInvoke();
  if (invoke) {
    return invoke<UsageReportResult>("ai_usage_report", { dimension, windowDays, key });
  }

  const params = new URLSearchParams({
    dimension,
    windowDays: String(windowDays),
  });
  if (key) {
    params.set("key", key);
  }
  return requestJson<UsageReportResult>(`/api/ai/usage/report?${params.toString()}`);
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${backendBaseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch {
    throw new Error(
      `Cannot connect to backend at ${backendBaseUrl}. Run RSSReader/scripts/backend-dev.cmd first.`,
    );
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

async function streamTranslationRequest(
  request: StartTranslationRequest,
  onChunk?: (view: TranslationView) => void,
): Promise<TranslationView> {
  const response = await fetch(`${backendBaseUrl}/api/ai/translation/stream`, {
    method: "POST",
    body: JSON.stringify(request),
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("Streaming response is not available in this browser.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalView: TranslationView | undefined;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const rawLine = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (rawLine) {
        const chunk = JSON.parse(rawLine) as TranslationStreamChunk;
        if (chunk.translation) {
          finalView = chunk.translation;
          onChunk?.(chunk.translation);
        }
        if (chunk.errorMessage) {
          throw new Error(chunk.errorMessage);
        }
        if (chunk.done && finalView) {
          return finalView;
        }
      }
      newlineIndex = buffer.indexOf("\n");
    }
  }

  const tail = buffer.trim();
  if (tail) {
    const chunk = JSON.parse(tail) as TranslationStreamChunk;
    if (chunk.translation) {
      finalView = chunk.translation;
      onChunk?.(chunk.translation);
    }
    if (chunk.errorMessage) {
      throw new Error(chunk.errorMessage);
    }
    if (chunk.done && finalView) {
      return finalView;
    }
  }

  if (finalView) {
    return finalView;
  }

  throw new Error("Translation stream ended without a result.");
}

async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? `Request failed with ${response.status}`;
  } catch {
    return `Request failed with ${response.status}`;
  }
}
