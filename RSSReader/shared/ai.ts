/**
 * AI module contracts shared by frontend and backend (Tauri commands / dev-server REST).
 */

export type AgentType = "summary" | "translation" | "tagging";

export type SummaryDetailLevel = "short" | "medium" | "detailed";

export type TranslationPromptStrategy = "standard" | "hy_mt_optimized";

export interface AiProvider {
  id: string;
  displayName: string;
  baseUrl: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiModel {
  id: string;
  providerId: string;
  modelName: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiProviderListResult {
  providers: AiProvider[];
}

export interface AiModelListResult {
  models: AiModel[];
}

export interface CreateAiProviderRequest {
  displayName: string;
  baseUrl: string;
  apiKey: string;
}

export interface UpdateAiProviderRequest {
  displayName?: string;
  baseUrl?: string;
  apiKey?: string;
  isEnabled?: boolean;
}

export interface CreateAiModelRequest {
  providerId: string;
  modelName: string;
}

export interface UpdateAiModelRequest {
  modelName?: string;
  isEnabled?: boolean;
}

export interface ProviderTestRequest {
  providerId?: string;
  baseUrl?: string;
  apiKey?: string;
  modelName?: string;
}

export interface ProviderTestResult {
  ok: boolean;
  message: string;
}

export interface SummaryAgentConfig {
  defaultTargetLanguage: string;
  defaultDetailLevel: SummaryDetailLevel;
}

export interface TranslationAgentConfig {
  defaultTargetLanguage: string;
  concurrency: number;
  promptStrategy: TranslationPromptStrategy;
}

export interface TaggingAgentConfig {
  // Reserved for future tagging policy knobs.
}

export interface AiAgentSettings {
  agentType: AgentType;
  primaryModelId?: string;
  fallbackModelId?: string;
  summary?: SummaryAgentConfig;
  translation?: TranslationAgentConfig;
  tagging?: TaggingAgentConfig;
}

export interface ArticleSummaryRecord {
  id: string;
  articleId: string;
  targetLanguage: string;
  detailLevel: SummaryDetailLevel;
  content: string;
  modelId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetSummaryRequest {
  articleId: string;
  targetLanguage: string;
  detailLevel: SummaryDetailLevel;
}

export interface StartSummaryRequest {
  articleId: string;
  targetLanguage: string;
  detailLevel: SummaryDetailLevel;
}

export interface SummaryStreamChunk {
  delta: string;
  done: boolean;
}

export interface TranslationStreamChunk {
  translation: TranslationView | null;
  done: boolean;
  errorMessage: string | null;
}

export interface TranslationSegmentView {
  id: string;
  segmentIndex: number;
  segmentTag: string;
  sourceHtml: string;
  translatedText?: string;
  status: string;
}

export interface TranslationView {
  runId: string;
  articleId: string;
  targetLanguage: string;
  translatedTitle?: string;
  status: string;
  bilingualHtml?: string;
  bilingualAligned: boolean;
  bilingualPlaced: number;
  bilingualExpected: number;
  segments: TranslationSegmentView[];
}

export interface StartTranslationRequest {
  articleId: string;
  targetLanguage: string;
  selectedText?: string;
}

export interface TaggingSuggestRequest {
  articleId: string;
}

export interface TaggingSuggestResult {
  tags: string[];
  fallbackNotice?: string;
}

export interface AssignTagsRequest {
  articleId: string;
  tags: string[];
  source: "manual" | "ai";
}

export interface AssignTagsResult {
  tags: Array<{
    id: string;
    name: string;
    source: string;
  }>;
}

export interface UsageReportRow {
  key: string;
  label: string;
  requestCount: number;
  totalTokens: number;
  succeededCount: number;
  failedCount: number;
}

export interface UsageDailyRow {
  date: string;
  requestCount: number;
  totalTokens: number;
}

export interface UsageReportResult {
  dimension: string;
  windowDays: number;
  key?: string;
  rows: UsageReportRow[];
  dailyRows?: UsageDailyRow[];
  totalRequests: number;
  totalTokens: number;
}

export interface PromptRevealResult {
  path: string;
  created: boolean;
}
