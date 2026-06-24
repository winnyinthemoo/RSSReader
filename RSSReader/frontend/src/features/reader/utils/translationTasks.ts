import type { RetryTranslationSegmentRequest, StartTranslationRequest, TranslationView } from "../../../../../shared/ai";
import { getArticleTranslation, retryTranslationSegment, startTranslation } from "../../../services/aiService";

export interface TranslationTaskSnapshot {
  articleId: string;
  targetLanguage: string;
  translation?: TranslationView;
  isLoading: boolean;
  errorMessage?: string;
  isCanceled: boolean;
}

type TranslationTaskSubscriber = (snapshot: TranslationTaskSnapshot | undefined) => void;

interface TranslationTaskRecord {
  snapshot: TranslationTaskSnapshot;
  controller?: AbortController;
  requestInFlight: boolean;
  generation: number;
}

const tasks = new Map<string, TranslationTaskRecord>();
const subscribers = new Map<string, Set<TranslationTaskSubscriber>>();

export function translationTaskKey(articleId: string, targetLanguage: string) {
  return `${articleId}::${targetLanguage}`;
}

export function getTranslationTaskSnapshot(
  articleId: string,
  targetLanguage: string,
): TranslationTaskSnapshot | undefined {
  return tasks.get(translationTaskKey(articleId, targetLanguage))?.snapshot;
}

export function subscribeTranslationTask(
  articleId: string,
  targetLanguage: string,
  subscriber: TranslationTaskSubscriber,
) {
  const key = translationTaskKey(articleId, targetLanguage);
  const keySubscribers = subscribers.get(key) ?? new Set<TranslationTaskSubscriber>();
  keySubscribers.add(subscriber);
  subscribers.set(key, keySubscribers);
  subscriber(tasks.get(key)?.snapshot);

  return () => {
    keySubscribers.delete(subscriber);
    if (keySubscribers.size === 0) {
      subscribers.delete(key);
    }
  };
}

export function startArticleTranslationTask(
  request: StartTranslationRequest,
  options: { forceRefresh?: boolean } = {},
) {
  const key = translationTaskKey(request.articleId, request.targetLanguage);
  const existing = tasks.get(key);

  if (existing?.requestInFlight) {
    existing.snapshot = {
      ...existing.snapshot,
      isLoading: true,
      isCanceled: false,
      errorMessage: undefined,
    };
    notify(key);
    return existing.snapshot;
  }

  const controller = new AbortController();
  const generation = (existing?.generation ?? 0) + 1;
  const record: TranslationTaskRecord = {
    controller,
    generation,
    requestInFlight: true,
    snapshot: {
      articleId: request.articleId,
      targetLanguage: request.targetLanguage,
      translation: existing?.snapshot.translation,
      isLoading: true,
      errorMessage: undefined,
      isCanceled: false,
    },
  };
  tasks.set(key, record);
  notify(key);

  void runTranslationTask(key, record, request, Boolean(options.forceRefresh));
  return record.snapshot;
}

export function cancelArticleTranslationTask(articleId: string, targetLanguage: string) {
  const key = translationTaskKey(articleId, targetLanguage);
  const record = tasks.get(key);
  if (!record) {
    return;
  }

  record.controller?.abort();
  record.snapshot = {
    ...record.snapshot,
    isLoading: false,
    isCanceled: true,
    errorMessage: undefined,
  };
  notify(key);
}

export async function retryTranslationSegmentTask(
  request: RetryTranslationSegmentRequest,
): Promise<TranslationView> {
  const key = translationTaskKey(request.articleId, request.targetLanguage);
  const existing = tasks.get(key);
  const baseSnapshot: TranslationTaskSnapshot = existing?.snapshot ?? {
    articleId: request.articleId,
    targetLanguage: request.targetLanguage,
    isLoading: false,
    isCanceled: false,
  };
  const generation = (existing?.generation ?? 0) + 1;
  const record: TranslationTaskRecord = existing ?? {
    generation,
    requestInFlight: false,
    snapshot: baseSnapshot,
  };
  record.generation = generation;
  record.snapshot = {
    ...baseSnapshot,
    errorMessage: undefined,
    isCanceled: false,
  };
  tasks.set(key, record);
  notify(key);

  try {
    const translation = await retryTranslationSegment(request);
    if (tasks.get(key)?.generation === generation) {
      record.snapshot = {
        ...record.snapshot,
        translation,
        errorMessage: undefined,
      };
      notify(key);
    }
    return translation;
  } catch (error) {
    if (tasks.get(key)?.generation === generation) {
      record.snapshot = {
        ...record.snapshot,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
      notify(key);
    }
    throw error;
  }
}

async function runTranslationTask(
  key: string,
  record: TranslationTaskRecord,
  request: StartTranslationRequest,
  forceRefresh: boolean,
) {
  try {
    if (!forceRefresh) {
      const cached = await getArticleTranslation(request.articleId, request.targetLanguage);
      if (!isCurrentRecord(key, record)) {
        return;
      }
      if (cached && cached.segments.length > 0) {
        record.snapshot = {
          ...record.snapshot,
          translation: cached,
          errorMessage: undefined,
        };
        notify(key);
        if (cached.status !== "failed" && cached.status !== "running") {
          record.snapshot = {
            ...record.snapshot,
            isLoading: false,
          };
          record.requestInFlight = false;
          notify(key);
          return;
        }
      }
    }

    const result = await startTranslation(
      request,
      (view) => {
        if (!isCurrentRecord(key, record)) {
          return;
        }
        record.snapshot = {
          ...record.snapshot,
          translation: view,
          isLoading: !record.snapshot.isCanceled && view.status === "running",
          errorMessage: undefined,
        };
        notify(key);
      },
      { signal: record.controller?.signal },
    );

    if (!isCurrentRecord(key, record)) {
      return;
    }
    record.snapshot = {
      ...record.snapshot,
      translation: result,
      isLoading: false,
      errorMessage: undefined,
    };
  } catch (error) {
    if (!isCurrentRecord(key, record)) {
      return;
    }
    if (isAbortError(error)) {
      record.snapshot = {
        ...record.snapshot,
        isLoading: false,
        isCanceled: true,
        errorMessage: undefined,
      };
    } else {
      record.snapshot = {
        ...record.snapshot,
        isLoading: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  } finally {
    if (isCurrentRecord(key, record)) {
      record.requestInFlight = false;
      record.controller = undefined;
      notify(key);
    }
  }
}

function isCurrentRecord(key: string, record: TranslationTaskRecord) {
  return tasks.get(key) === record;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function notify(key: string) {
  const snapshot = tasks.get(key)?.snapshot;
  subscribers.get(key)?.forEach((subscriber) => subscriber(snapshot));
}