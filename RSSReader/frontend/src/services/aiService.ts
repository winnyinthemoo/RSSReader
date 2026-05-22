import type {
  AiAgentSettings,
  AiModel,
  AiModelListResult,
  AiProvider,
  AiProviderListResult,
  ArticleSummaryRecord,
  AssignTagsRequest,
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
  UpdateAiModelRequest,
  UpdateAiProviderRequest,
  UsageReportResult,
} from "../../../shared/ai";

const backendBaseUrl = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:5181";

export async function listAiProviders(): Promise<AiProviderListResult> {
  return requestJson<AiProviderListResult>("/api/ai/providers");
}

export async function createAiProvider(
  request: CreateAiProviderRequest,
): Promise<AiProvider> {
  return requestJson<AiProvider>("/api/ai/providers", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function deleteAiProvider(providerId: string): Promise<void> {
  await requestJson<{ ok: boolean }>(
    `/api/ai/providers/${encodeURIComponent(providerId)}`,
    { method: "DELETE" },
  );
}

export async function listAiModels(): Promise<AiModelListResult> {
  return requestJson<AiModelListResult>("/api/ai/models");
}

export async function createAiModel(request: CreateAiModelRequest): Promise<AiModel> {
  return requestJson<AiModel>("/api/ai/models", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function testAiProvider(
  request: ProviderTestRequest,
): Promise<ProviderTestResult> {
  return requestJson<ProviderTestResult>("/api/ai/providers/test", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function getAiAgentSettings(agent: string): Promise<AiAgentSettings> {
  return requestJson<AiAgentSettings>(`/api/ai/settings/${encodeURIComponent(agent)}`);
}

export async function updateAiAgentSettings(
  settings: AiAgentSettings,
): Promise<AiAgentSettings> {
  return requestJson<AiAgentSettings>(
    `/api/ai/settings/${encodeURIComponent(settings.agentType)}`,
    {
      method: "PUT",
      body: JSON.stringify(settings),
    },
  );
}

export async function revealAiPrompt(agent: string): Promise<PromptRevealResult> {
  return requestJson<PromptRevealResult>(
    `/api/ai/prompts/reveal/${encodeURIComponent(agent)}`,
    { method: "POST" },
  );
}

export async function getArticleSummary(
  request: GetSummaryRequest,
): Promise<ArticleSummaryRecord | null> {
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
  return requestJson<SummaryStreamChunk>("/api/ai/summary/stream", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function suggestTags(
  request: TaggingSuggestRequest,
): Promise<TaggingSuggestResult> {
  return requestJson<TaggingSuggestResult>("/api/ai/tagging/suggest", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function assignTags(request: AssignTagsRequest): Promise<void> {
  await requestJson<{ ok: boolean }>("/api/ai/tags/assign", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function getArticleTranslation(
  articleId: string,
  targetLanguage: string,
): Promise<TranslationView | null> {
  const params = new URLSearchParams({
    articleId,
    targetLanguage,
  });
  return requestJson<TranslationView | null>(`/api/ai/translation?${params.toString()}`);
}

export async function startTranslation(
  request: StartTranslationRequest,
): Promise<TranslationView> {
  return requestJson<TranslationView>("/api/ai/translation/start", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function getUsageReport(
  dimension: string,
  windowDays: number,
): Promise<UsageReportResult> {
  const params = new URLSearchParams({
    dimension,
    windowDays: String(windowDays),
  });
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

async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? `Request failed with ${response.status}`;
  } catch {
    return `Request failed with ${response.status}`;
  }
}
