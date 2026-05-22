import { useEffect, useState } from "react";

import type {
  AiAgentSettings,
  AiModel,
  AiProvider,
  ProviderTestResult,
  SummaryDetailLevel,
  TranslationPromptStrategy,
} from "../../../../../shared/ai";
import {
  createAiModel,
  createAiProvider,
  deleteAiProvider,
  getAiAgentSettings,
  listAiModels,
  listAiProviders,
  testAiProvider,
  updateAiAgentSettings,
} from "../../../services/aiService";

interface AiSettingsPageProps {
  onClose: () => void;
}

export function AiSettingsPage({ onClose }: AiSettingsPageProps) {
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [models, setModels] = useState<AiModel[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [displayName, setDisplayName] = useState("DeepSeek");
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [testModel, setTestModel] = useState("deepseek-chat");
  const [newModelProviderId, setNewModelProviderId] = useState("");
  const [newModelName, setNewModelName] = useState("deepseek-chat");
  const [summaryModelId, setSummaryModelId] = useState("");
  const [summaryLanguage, setSummaryLanguage] = useState("zh-Hans");
  const [summaryDetailLevel, setSummaryDetailLevel] =
    useState<SummaryDetailLevel>("medium");
  const [translationModelId, setTranslationModelId] = useState("");
  const [translationLanguage, setTranslationLanguage] = useState("zh-Hans");
  const [translationStrategy, setTranslationStrategy] =
    useState<TranslationPromptStrategy>("standard");
  const [testResult, setTestResult] = useState<ProviderTestResult | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (providers.length === 0) {
      setSelectedProviderId("");
      setNewModelProviderId("");
      return;
    }
    if (!providers.some((provider) => provider.id === selectedProviderId)) {
      setSelectedProviderId(providers[providers.length - 1].id);
    }
    if (!providers.some((provider) => provider.id === newModelProviderId)) {
      setNewModelProviderId(providers[0].id);
    }
  }, [providers, selectedProviderId, newModelProviderId]);

  useEffect(() => {
    if (!summaryModelId && models.length > 0) {
      setSummaryModelId(models[0].id);
    }
    if (summaryModelId && !models.some((model) => model.id === summaryModelId)) {
      setSummaryModelId(models[0]?.id ?? "");
    }
    if (!translationModelId && models.length > 0) {
      setTranslationModelId(models[0].id);
    }
    if (
      translationModelId &&
      !models.some((model) => model.id === translationModelId)
    ) {
      setTranslationModelId(models[0]?.id ?? "");
    }
  }, [models, summaryModelId, translationModelId]);

  async function loadAll() {
    try {
      setIsLoading(true);
      const [providerResult, modelResult, summarySettings, translationSettings] =
        await Promise.all([
          listAiProviders(),
          listAiModels(),
          getAiAgentSettings("summary"),
          getAiAgentSettings("translation"),
        ]);
      setProviders(providerResult.providers);
      setModels(modelResult.models);
      setSummaryModelId(summarySettings.primaryModelId ?? "");
      setSummaryLanguage(
        summarySettings.summary?.defaultTargetLanguage ?? "zh-Hans",
      );
      setSummaryDetailLevel(
        summarySettings.summary?.defaultDetailLevel ?? "medium",
      );
      setTranslationModelId(translationSettings.primaryModelId ?? "");
      setTranslationLanguage(
        translationSettings.translation?.defaultTargetLanguage ?? "zh-Hans",
      );
      setTranslationStrategy(
        translationSettings.translation?.promptStrategy ?? "standard",
      );
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateProvider() {
    try {
      setIsLoading(true);
      setStatusMessage(undefined);
      const created = await createAiProvider({ displayName, baseUrl, apiKey });
      setApiKey("");
      setSelectedProviderId(created.id);
      setNewModelProviderId(created.id);
      await loadAll();
      setErrorMessage(undefined);
      setStatusMessage(`Provider "${created.displayName}" saved.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateModel() {
    if (!newModelProviderId || !newModelName.trim()) {
      setErrorMessage("Select a provider and enter a model name.");
      return;
    }
    try {
      setIsLoading(true);
      const created = await createAiModel({
        providerId: newModelProviderId,
        modelName: newModelName.trim(),
      });
      await loadAll();
      setSummaryModelId(created.id);
      setErrorMessage(undefined);
      setStatusMessage(`Model "${created.modelName}" saved.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveTranslationSettings() {
    if (!translationModelId) {
      setErrorMessage("Add a model and select it for Translation first.");
      return;
    }
    try {
      setIsLoading(true);
      const settings: AiAgentSettings = {
        agentType: "translation",
        primaryModelId: translationModelId,
        translation: {
          defaultTargetLanguage: translationLanguage,
          concurrency: 3,
          promptStrategy: translationStrategy,
        },
      };
      await updateAiAgentSettings(settings);
      setErrorMessage(undefined);
      setStatusMessage("Translation agent settings saved.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveSummarySettings() {
    if (!summaryModelId) {
      setErrorMessage("Add a model and select it for Summary first.");
      return;
    }
    try {
      setIsLoading(true);
      const settings: AiAgentSettings = {
        agentType: "summary",
        primaryModelId: summaryModelId,
        summary: {
          defaultTargetLanguage: summaryLanguage,
          defaultDetailLevel: summaryDetailLevel,
        },
      };
      await updateAiAgentSettings(settings);
      setErrorMessage(undefined);
      setStatusMessage("Summary agent settings saved.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTestSelected() {
    if (!selectedProviderId) {
      setErrorMessage("Select a provider to test.");
      return;
    }
    try {
      setIsLoading(true);
      setTestResult(undefined);
      setErrorMessage(undefined);
      setStatusMessage("Testing connection…");
      const result = await testAiProvider({
        providerId: selectedProviderId,
        modelName: testModel,
      });
      setTestResult(result);
      setStatusMessage(undefined);
    } catch (error) {
      setStatusMessage(undefined);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteSelected() {
    if (!selectedProviderId) {
      return;
    }
    const provider = providers.find((item) => item.id === selectedProviderId);
    if (!provider) {
      return;
    }
    const confirmed = window.confirm(
      `Delete provider "${provider.displayName}"? Models and agent settings referencing it may break.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage(undefined);
      await deleteAiProvider(selectedProviderId);
      setTestResult(undefined);
      await loadAll();
      setErrorMessage(undefined);
      setStatusMessage(`Provider "${provider.displayName}" deleted.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId);

  return (
    <div className="ai-settings-overlay" role="dialog" aria-label="AI settings">
      <section className="ai-settings-panel">
        <header className="ai-settings-header">
          <div>
            <p className="eyebrow">AI</p>
            <h2>Provider &amp; Models</h2>
          </div>
          <button className="tool-button" type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="ai-settings-body">
          <section>
            <h3>Add Provider</h3>
            <label className="ai-field">
              <span>Display name</span>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
            <label className="ai-field">
              <span>Base URL</span>
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            </label>
            <label className="ai-field">
              <span>API Key</span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Stored locally by backend"
              />
            </label>
            <button
              className="primary-button"
              type="button"
              disabled={isLoading || !apiKey.trim()}
              onClick={() => void handleCreateProvider()}
            >
              Save Provider
            </button>
          </section>

          <section>
            <h3>Add Model</h3>
            <label className="ai-field">
              <span>Provider</span>
              <select
                value={newModelProviderId}
                onChange={(event) => setNewModelProviderId(event.target.value)}
                disabled={providers.length === 0 || isLoading}
              >
                {providers.length === 0 ? (
                  <option value="">Add a provider first</option>
                ) : (
                  providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.displayName}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="ai-field">
              <span>Model name</span>
              <input
                value={newModelName}
                onChange={(event) => setNewModelName(event.target.value)}
                placeholder="deepseek-chat"
              />
            </label>
            <button
              className="secondary-button"
              type="button"
              disabled={isLoading || !newModelProviderId || !newModelName.trim()}
              onClick={() => void handleCreateModel()}
            >
              Save Model
            </button>
            {models.length > 0 ? (
              <ul className="ai-provider-list">
                {models.map((model) => (
                  <li key={model.id}>
                    <strong>{model.modelName}</strong>
                    <span>{model.id}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section>
            <h3>Summary agent</h3>
            <p className="ai-hint">
              Required before Generate in the reader. Pick the model used for article summaries.
            </p>
            <label className="ai-field">
              <span>Primary model</span>
              <select
                value={summaryModelId}
                onChange={(event) => setSummaryModelId(event.target.value)}
                disabled={models.length === 0 || isLoading}
              >
                {models.length === 0 ? (
                  <option value="">No models yet</option>
                ) : (
                  models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.modelName}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="ai-field">
              <span>Default language</span>
              <select
                value={summaryLanguage}
                onChange={(event) => setSummaryLanguage(event.target.value)}
                disabled={isLoading}
              >
                <option value="zh-Hans">简体中文</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="ai-field">
              <span>Default detail</span>
              <select
                value={summaryDetailLevel}
                onChange={(event) =>
                  setSummaryDetailLevel(event.target.value as SummaryDetailLevel)
                }
                disabled={isLoading}
              >
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="detailed">Detailed</option>
              </select>
            </label>
            <button
              className="primary-button"
              type="button"
              disabled={isLoading || !summaryModelId}
              onClick={() => void handleSaveSummarySettings()}
            >
              Save Summary Settings
            </button>
          </section>

          <section>
            <h3>Translation agent</h3>
            <p className="ai-hint">
              Required before using the reader Translate button. HY-MT works better for
              some local Chinese models.
            </p>
            <label className="ai-field">
              <span>Primary model</span>
              <select
                value={translationModelId}
                onChange={(event) => setTranslationModelId(event.target.value)}
                disabled={models.length === 0 || isLoading}
              >
                {models.length === 0 ? (
                  <option value="">No models yet</option>
                ) : (
                  models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.modelName}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="ai-field">
              <span>Default target language</span>
              <select
                value={translationLanguage}
                onChange={(event) => setTranslationLanguage(event.target.value)}
                disabled={isLoading}
              >
                <option value="zh-Hans">简体中文</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="ai-field">
              <span>Prompt strategy</span>
              <select
                value={translationStrategy}
                onChange={(event) =>
                  setTranslationStrategy(
                    event.target.value as TranslationPromptStrategy,
                  )
                }
                disabled={isLoading}
              >
                <option value="standard">Standard</option>
                <option value="hy_mt_optimized">HY-MT optimized</option>
              </select>
            </label>
            <button
              className="primary-button"
              type="button"
              disabled={isLoading || !translationModelId}
              onClick={() => void handleSaveTranslationSettings()}
            >
              Save Translation Settings
            </button>
          </section>

          <section>
            <h3>Test connection</h3>
            <label className="ai-field">
              <span>Provider</span>
              <select
                value={selectedProviderId}
                onChange={(event) => {
                  setSelectedProviderId(event.target.value);
                  setTestResult(undefined);
                }}
                disabled={providers.length === 0 || isLoading}
              >
                {providers.length === 0 ? (
                  <option value="">No providers yet</option>
                ) : (
                  providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.displayName}
                    </option>
                  ))
                )}
              </select>
            </label>
            {selectedProvider ? (
              <p className="ai-hint">{selectedProvider.baseUrl}</p>
            ) : null}
            <label className="ai-field">
              <span>Test model</span>
              <input value={testModel} onChange={(e) => setTestModel(e.target.value)} />
            </label>
            <div className="ai-settings-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={isLoading || !selectedProviderId}
                onClick={() => void handleTestSelected()}
              >
                {isLoading && statusMessage === "Testing connection…"
                  ? "Testing…"
                  : "Test Connection"}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={isLoading || !selectedProviderId}
                onClick={() => void handleDeleteSelected()}
              >
                Delete Provider
              </button>
            </div>
            {testResult ? (
              <p className={testResult.ok ? "ai-status-ok" : "ai-status-error"}>
                {testResult.message}
              </p>
            ) : null}
          </section>

          <section>
            <h3>Providers ({providers.length})</h3>
            <ul className="ai-provider-list">
              {providers.map((provider) => (
                <li key={provider.id}>
                  <strong>{provider.displayName}</strong>
                  <span>{provider.baseUrl}</span>
                </li>
              ))}
            </ul>
          </section>

          {statusMessage ? <p className="ai-status-ok">{statusMessage}</p> : null}
          {errorMessage ? <p className="ai-status-error">{errorMessage}</p> : null}
        </div>
      </section>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong.";
}
