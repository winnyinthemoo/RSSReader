import { useEffect, useId, useMemo, useState } from "react";
import { LineChart, X } from "lucide-react";

import type {
  AgentType,
  AiAgentSettings,
  AiModel,
  AiProvider,
  ProviderTestResult,
  SummaryDetailLevel,
  TranslationPromptStrategy,
  UsageReportResult,
} from "../../../../../shared/ai";
import {
  createAiModel,
  createAiProvider,
  deleteAiModel,
  deleteAiProvider,
  getAiAgentSettings,
  getUsageReport,
  listAiModels,
  listAiProviders,
  testAiProvider,
  updateAiAgentSettings,
  updateAiModel,
  updateAiProvider,
} from "../../../services/aiService";

interface AiSettingsPageProps {
  onClose: () => void;
}

type AiSettingsTab = "providers" | "models" | "agents";
type AgentPanelType = Extract<AgentType, "summary" | "translation" | "tagging">;
type UsageDimension = "provider" | "model" | "agent";

const tabs: { id: AiSettingsTab; label: string }[] = [
  { id: "providers", label: "Providers" },
  { id: "models", label: "Models" },
  { id: "agents", label: "Agents" },
];

export function AiSettingsPage({ onClose }: AiSettingsPageProps) {
  const [activeTab, setActiveTab] = useState<AiSettingsTab>("providers");
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [models, setModels] = useState<AiModel[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [activeAgent, setActiveAgent] = useState<AgentPanelType>("summary");
  const [usageReport, setUsageReport] = useState<UsageReportResult | undefined>();

  const [providerName, setProviderName] = useState("DeepSeek");
  const [providerBaseUrl, setProviderBaseUrl] = useState("https://api.deepseek.com/v1");
  const [providerApiKey, setProviderApiKey] = useState("");
  const [providerEnabled, setProviderEnabled] = useState(true);

  const [modelProviderId, setModelProviderId] = useState("");
  const [modelName, setModelName] = useState("deepseek-chat");
  const [modelEnabled, setModelEnabled] = useState(true);

  const [summaryModelId, setSummaryModelId] = useState("");
  const [summaryLanguage, setSummaryLanguage] = useState("zh-Hans");
  const [summaryDetailLevel, setSummaryDetailLevel] =
    useState<SummaryDetailLevel>("medium");
  const [translationModelId, setTranslationModelId] = useState("");
  const [translationLanguage, setTranslationLanguage] = useState("zh-Hans");
  const [translationConcurrency, setTranslationConcurrency] = useState(3);
  const [translationStrategy, setTranslationStrategy] =
    useState<TranslationPromptStrategy>("standard");
  const [taggingModelId, setTaggingModelId] = useState("");

  const [testModelName, setTestModelName] = useState("deepseek-chat");
  const [testResult, setTestResult] = useState<ProviderTestResult | undefined>();
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  
  const [deleteProviderId, setDeleteProviderId] = useState<string | null>(null);
  const [deleteModelId, setDeleteModelId] = useState<string | null>(null);


  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId);
  const selectedModel = models.find((model) => model.id === selectedModelId);
  const usageDimension = tabUsageDimension(activeTab);

  const modelsByProvider = useMemo(() => {
    const groups = new Map<string, AiModel[]>();
    models.forEach((model) => {
      groups.set(model.providerId, [...(groups.get(model.providerId) ?? []), model]);
    });
    return groups;
  }, [models]);

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    void loadUsage(usageDimension);
  }, [usageDimension]);

  useEffect(() => {
    if (selectedProvider) {
      setProviderName(selectedProvider.displayName);
      setProviderBaseUrl(selectedProvider.baseUrl);
      setProviderEnabled(selectedProvider.isEnabled);
      return;
    }

    if (selectedProviderId && providers.length > 0) {
      setSelectedProviderId(providers[0].id);
    }
  }, [providers, selectedProvider, selectedProviderId]);

  useEffect(() => {
    if (selectedModel) {
      setModelProviderId(selectedModel.providerId);
      setModelName(selectedModel.modelName);
      setModelEnabled(selectedModel.isEnabled);
      return;
    }

    if (selectedModelId && models.length > 0) {
      setSelectedModelId(models[0].id);
    }
  }, [models, selectedModel, selectedModelId]);

  useEffect(() => {
    if (!modelProviderId && providers[0]) {
      setModelProviderId(providers[0].id);
    }
  }, [modelProviderId, providers]);

  async function loadAll() {
    setIsLoading(true);
    try {
      const [providerResult, modelResult, summaryResult, translationResult, taggingResult] =
        await Promise.allSettled([
          listAiProviders(),
          listAiModels(),
          getAiAgentSettings("summary"),
          getAiAgentSettings("translation"),
          getAiAgentSettings("tagging"),
        ]);

      const loadErrors: string[] = [];

      if (providerResult.status === "fulfilled") {
        const nextProviders = providerResult.value.providers;
        setProviders(nextProviders);
        if (!selectedProviderId && nextProviders[0]) {
          setSelectedProviderId(nextProviders[0].id);
        }
      } else {
        loadErrors.push(`Providers: ${getErrorMessage(providerResult.reason)}`);
      }

      if (modelResult.status === "fulfilled") {
        const nextModels = modelResult.value.models;
        setModels(nextModels);
        if (!selectedModelId && nextModels[0]) {
          setSelectedModelId(nextModels[0].id);
        }
      } else {
        loadErrors.push(`Models: ${getErrorMessage(modelResult.reason)}`);
      }

      if (summaryResult.status === "fulfilled") {
        applySummarySettings(summaryResult.value);
      } else {
        loadErrors.push(`Summary: ${getErrorMessage(summaryResult.reason)}`);
      }

      if (translationResult.status === "fulfilled") {
        applyTranslationSettings(translationResult.value);
      } else {
        loadErrors.push(`Translation: ${getErrorMessage(translationResult.reason)}`);
      }

      if (taggingResult.status === "fulfilled") {
        setTaggingModelId(taggingResult.value.primaryModelId ?? "");
      } else {
        loadErrors.push(`Tag: ${getErrorMessage(taggingResult.reason)}`);
      }

      setErrorMessage(loadErrors.length > 0 ? loadErrors.join(" ") : undefined);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadUsage(nextDimension: UsageDimension) {
    try {
      const report = await getUsageReport(nextDimension, 7);
      setUsageReport(report);
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  function applySummarySettings(settings: AiAgentSettings) {
    setSummaryModelId(settings.primaryModelId ?? "");
    setSummaryLanguage(settings.summary?.defaultTargetLanguage ?? "zh-Hans");
    setSummaryDetailLevel(settings.summary?.defaultDetailLevel ?? "medium");
  }

  function applyTranslationSettings(settings: AiAgentSettings) {
    setTranslationModelId(settings.primaryModelId ?? "");
    setTranslationLanguage(settings.translation?.defaultTargetLanguage ?? "zh-Hans");
    setTranslationConcurrency(settings.translation?.concurrency ?? 3);
    setTranslationStrategy(settings.translation?.promptStrategy ?? "standard");
  }

  async function handleSaveProvider() {
    if (!providerName.trim() || !providerBaseUrl.trim()) {
      setErrorMessage("Provider name and Base URL are required.");
      return;
    }
    if (!selectedProviderId && !providerApiKey.trim()) {
      setErrorMessage("API Key is required for a new provider.");
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage(undefined);
      const provider = selectedProviderId
        ? await updateAiProvider(selectedProviderId, {
            displayName: providerName.trim(),
            baseUrl: providerBaseUrl.trim(),
            apiKey: providerApiKey.trim() || undefined,
            isEnabled: providerEnabled,
          })
        : await createAiProvider({
            displayName: providerName.trim(),
            baseUrl: providerBaseUrl.trim(),
            apiKey: providerApiKey.trim(),
          });
      setSelectedProviderId(provider.id);
      setProviderApiKey("");
      await loadAll();
      setSelectedProviderId(provider.id);
      setStatusMessage(`Provider "${provider.displayName}" saved.`);
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteProvider() {
    if (!selectedProvider) {
      return;
    }
    setDeleteProviderId(selectedProvider.id);
  }

  async function confirmDeleteProvider() {
    if (!deleteProviderId) return;
    const provider = providers.find(p => p.id === deleteProviderId);
    try {
      setIsLoading(true);
      await deleteAiProvider(deleteProviderId);
      setSelectedProviderId("");
      setTestResult(undefined);
      await loadAll();
      setStatusMessage(`Provider "${provider?.displayName}" deleted.`);
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
      setDeleteProviderId(null);
    }
  }

  async function handleTestProvider() {
    if (!selectedProviderId) {
      setErrorMessage("Select a provider first.");
      return;
    }
    try {
      setIsLoading(true);
      setTestResult(undefined);
      const result = await testAiProvider({
        providerId: selectedProviderId,
        modelName: testModelName,
      });
      setTestResult(result);
      setStatusMessage(undefined);
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveModel() {
    if (!modelProviderId || !modelName.trim()) {
      setErrorMessage("Provider and model name are required.");
      return;
    }
    try {
      setIsLoading(true);
      const model = selectedModelId
        ? await updateAiModel(selectedModelId, {
            modelName: modelName.trim(),
            isEnabled: modelEnabled,
          })
        : await createAiModel({
            providerId: modelProviderId,
            modelName: modelName.trim(),
          });
      setSelectedModelId(model.id);
      await loadAll();
      setSelectedModelId(model.id);
      setStatusMessage(`Model "${model.modelName}" saved.`);
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteModel() {
    if (!selectedModel) {
      return;
    }
    setDeleteModelId(selectedModel.id);
  }

  async function confirmDeleteModel() {
    if (!deleteModelId) return;
    const model = models.find(m => m.id === deleteModelId);
    try {
      setIsLoading(true);
      await deleteAiModel(deleteModelId);
      setSelectedModelId("");
      await loadAll();
      setStatusMessage(`Model "${model?.modelName}" deleted.`);
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
      setDeleteModelId(null);
    }
  }

  async function handleSaveAgent(agentType: AgentPanelType) {
    try {
      setIsLoading(true);
      const settings = buildAgentSettings(agentType);
      await updateAiAgentSettings(settings);
      setStatusMessage(`${agentLabel(agentType)} settings saved.`);
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  function buildAgentSettings(agentType: AgentPanelType): AiAgentSettings {
    if (agentType === "summary") {
      return {
        agentType,
        primaryModelId: summaryModelId,
        summary: {
          defaultTargetLanguage: summaryLanguage,
          defaultDetailLevel: summaryDetailLevel,
        },
      };
    }
    if (agentType === "translation") {
      return {
        agentType,
        primaryModelId: translationModelId,
        translation: {
          defaultTargetLanguage: translationLanguage,
          concurrency: translationConcurrency,
          promptStrategy: translationStrategy,
        },
      };
    }
    return {
      agentType,
      primaryModelId: taggingModelId,
      tagging: {},
    };
  }

  function resetProviderForm() {
    setSelectedProviderId("");
    setProviderName("");
    setProviderBaseUrl("https://api.example.com/v1");
    setProviderApiKey("");
    setProviderEnabled(true);
    setTestResult(undefined);
  }

  function resetModelForm() {
    setSelectedModelId("");
    setModelProviderId(providers[0]?.id ?? "");
    setModelName("");
    setModelEnabled(true);
  }

  return (
    <div className="ai-settings-overlay" role="dialog" aria-label="AI settings">
      <section className="ai-settings-panel ai-manager-panel">
        <header className="ai-settings-header ai-manager-header">
          <div>
            <h2>Model Settings</h2>
          </div>
          <button className="secondary-button" type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <nav className="ai-settings-tabs" aria-label="AI settings sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? "active" : ""}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="ai-manager-body">
          {activeTab === "providers" ? (
            <ProvidersTab
              providers={providers}
              modelsByProvider={modelsByProvider}
              selectedProviderId={selectedProviderId}
              providerName={providerName}
              providerBaseUrl={providerBaseUrl}
              providerApiKey={providerApiKey}
              providerEnabled={providerEnabled}
              testModelName={testModelName}
              testResult={testResult}
              usageReport={usageReport}
              isLoading={isLoading}
              onSelectProvider={(providerId) => {
                setSelectedProviderId(providerId);
                setTestResult(undefined);
              }}
              onAddProvider={resetProviderForm}
              onProviderNameChange={setProviderName}
              onProviderBaseUrlChange={setProviderBaseUrl}
              onProviderApiKeyChange={setProviderApiKey}
              onProviderEnabledChange={setProviderEnabled}
              onTestModelNameChange={setTestModelName}
              onSaveProvider={() => void handleSaveProvider()}
              onDeleteProvider={() => void handleDeleteProvider()}
              onTestProvider={() => void handleTestProvider()}
            />
          ) : null}

          {activeTab === "models" ? (
            <ModelsTab
              providers={providers}
              models={models}
              selectedModelId={selectedModelId}
              modelProviderId={modelProviderId}
              modelName={modelName}
              modelEnabled={modelEnabled}
              usageReport={usageReport}
              isLoading={isLoading}
              onSelectModel={setSelectedModelId}
              onAddModel={resetModelForm}
              onModelProviderChange={setModelProviderId}
              onModelNameChange={setModelName}
              onModelEnabledChange={setModelEnabled}
              onSaveModel={() => void handleSaveModel()}
              onDeleteModel={() => void handleDeleteModel()}
            />
          ) : null}

          {activeTab === "agents" ? (
            <AgentsTab
              models={models}
              activeAgent={activeAgent}
              summaryModelId={summaryModelId}
              summaryLanguage={summaryLanguage}
              summaryDetailLevel={summaryDetailLevel}
              translationModelId={translationModelId}
              translationLanguage={translationLanguage}
              translationConcurrency={translationConcurrency}
              translationStrategy={translationStrategy}
              taggingModelId={taggingModelId}
              usageReport={usageReport}
              isLoading={isLoading}
              onActiveAgentChange={setActiveAgent}
              onSummaryModelChange={setSummaryModelId}
              onSummaryLanguageChange={setSummaryLanguage}
              onSummaryDetailLevelChange={setSummaryDetailLevel}
              onTranslationModelChange={setTranslationModelId}
              onTranslationLanguageChange={setTranslationLanguage}
              onTranslationConcurrencyChange={setTranslationConcurrency}
              onTranslationStrategyChange={setTranslationStrategy}
              onTaggingModelChange={setTaggingModelId}
              onSaveAgent={(agent) => void handleSaveAgent(agent)}
            />
          ) : null}

        </div>

        <footer className="ai-manager-footer">
          <div>
            {statusMessage ? <span className="ai-status-ok">{statusMessage}</span> : null}
            {errorMessage ? <span className="ai-status-error">{errorMessage}</span> : null}
          </div>
        </footer>
        
        {/* 删除 Provider 确认弹窗 */}
        {deleteProviderId && (
          <div className="modal-backdrop" role="presentation" onMouseDown={() => setDeleteProviderId(null)}>
            <div className="add-feed-dialog" role="dialog" onMouseDown={(e) => e.stopPropagation()}>
              <div className="dialog-header">
                <h2>Confirm Delete</h2>
                <button type="button" onClick={() => setDeleteProviderId(null)}>
                  <X size={17} />
                </button>
              </div>
              <div className="confirm-body">
                <p>Are you sure you want to delete provider &quot;{providers.find(p => p.id === deleteProviderId)?.displayName}&quot;?</p>
              </div>
              <div className="dialog-actions">
                <button className="secondary-button" onClick={() => setDeleteProviderId(null)}>
                  Cancel
                </button>
                <button className="primary-button delete-button" onClick={confirmDeleteProvider}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 删除 Model 确认弹窗 */}
        {deleteModelId && (
          <div className="modal-backdrop" role="presentation" onMouseDown={() => setDeleteModelId(null)}>
            <div className="add-feed-dialog" role="dialog" onMouseDown={(e) => e.stopPropagation()}>
              <div className="dialog-header">
                <h2>Confirm Delete</h2>
                <button type="button" onClick={() => setDeleteModelId(null)}>
                  <X size={17} />
                </button>
              </div>
              <div className="confirm-body">
                <p>Are you sure you want to delete model &quot;{models.find(m => m.id === deleteModelId)?.modelName}&quot;?</p>
              </div>
              <div className="dialog-actions">
                <button className="secondary-button" onClick={() => setDeleteModelId(null)}>
                  Cancel
                </button>
                <button className="primary-button delete-button" onClick={confirmDeleteModel}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}



      </section>
    </div>
  );
}

interface ProvidersTabProps {
  providers: AiProvider[];
  modelsByProvider: Map<string, AiModel[]>;
  selectedProviderId: string;
  providerName: string;
  providerBaseUrl: string;
  providerApiKey: string;
  providerEnabled: boolean;
  testModelName: string;
  testResult?: ProviderTestResult;
  usageReport?: UsageReportResult;
  isLoading: boolean;
  onSelectProvider: (providerId: string) => void;
  onAddProvider: () => void;
  onProviderNameChange: (value: string) => void;
  onProviderBaseUrlChange: (value: string) => void;
  onProviderApiKeyChange: (value: string) => void;
  onProviderEnabledChange: (value: boolean) => void;
  onTestModelNameChange: (value: string) => void;
  onSaveProvider: () => void;
  onDeleteProvider: () => void;
  onTestProvider: () => void;
}

function ProvidersTab({
  providers,
  modelsByProvider,
  selectedProviderId,
  providerName,
  providerBaseUrl,
  providerApiKey,
  providerEnabled,
  testModelName,
  testResult,
  usageReport,
  isLoading,
  onSelectProvider,
  onAddProvider,
  onProviderNameChange,
  onProviderBaseUrlChange,
  onProviderApiKeyChange,
  onProviderEnabledChange,
  onTestModelNameChange,
  onSaveProvider,
  onDeleteProvider,
  onTestProvider,
}: ProvidersTabProps) {
  return (
    <div className="ai-manager-grid">
      <aside className="ai-manager-list" aria-label="Providers">
        <div className="ai-list-header">
          <h3>Providers</h3>
          <button className="secondary-button" type="button" onClick={onAddProvider}>
            Add
          </button>
        </div>
        {providers.length === 0 ? (
          <p className="muted">No providers yet.</p>
        ) : (
          providers.map((provider) => (
            <button
              key={provider.id}
              className={`ai-list-item ${selectedProviderId === provider.id ? "selected" : ""}`}
              type="button"
              onClick={() => onSelectProvider(provider.id)}
            >
              <strong>{provider.displayName}</strong>
              <span>{provider.baseUrl}</span>
              <small>{modelsByProvider.get(provider.id)?.length ?? 0} models</small>
            </button>
          ))
        )}
      </aside>

      <section className="ai-properties">
        <UsageSummary dimension="provider" report={usageReport} />
        <PanelTitle title="Properties" subtitle="Provider connection and local secret settings." />
        <div className="ai-form-grid">
          <label className="ai-field">
            <span>Name</span>
            <input value={providerName} onChange={(event) => onProviderNameChange(event.target.value)} />
          </label>
          <label className="ai-field">
            <span>Base URL</span>
            <input
              value={providerBaseUrl}
              onChange={(event) => onProviderBaseUrlChange(event.target.value)}
              placeholder="https://api.example.com/v1"
            />
          </label>
          <label className="ai-field">
            <span>API Key</span>
            <input
              type="password"
              value={providerApiKey}
              onChange={(event) => onProviderApiKeyChange(event.target.value)}
              placeholder={selectedProviderId ? "Leave blank to keep existing key" : "Required"}
            />
          </label>
          <label className="ai-check-field">
            <input
              type="checkbox"
              checked={providerEnabled}
              onChange={(event) => onProviderEnabledChange(event.target.checked)}
            />
            Enabled
          </label>
        </div>
        <div className="ai-settings-actions">
          <button className="primary-button" type="button" disabled={isLoading} onClick={onSaveProvider}>
            Save Provider
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={isLoading || !selectedProviderId}
            onClick={onDeleteProvider}
          >
            Delete
          </button>
        </div>

        <section className="ai-result-panel">
          <PanelTitle title="Result" subtitle="Run a lightweight provider connection test." />
          <label className="ai-field">
            <span>Test model</span>
            <input value={testModelName} onChange={(event) => onTestModelNameChange(event.target.value)} />
          </label>
          <button
            className="secondary-button"
            type="button"
            disabled={isLoading || !selectedProviderId}
            onClick={onTestProvider}
          >
            Test Connection
          </button>
          {testResult ? (
            <p className={testResult.ok ? "ai-status-ok" : "ai-status-error"}>{testResult.message}</p>
          ) : (
            <p className="muted">No test result yet.</p>
          )}
        </section>
      </section>
    </div>
  );
}

interface ModelsTabProps {
  providers: AiProvider[];
  models: AiModel[];
  selectedModelId: string;
  modelProviderId: string;
  modelName: string;
  modelEnabled: boolean;
  usageReport?: UsageReportResult;
  isLoading: boolean;
  onSelectModel: (modelId: string) => void;
  onAddModel: () => void;
  onModelProviderChange: (providerId: string) => void;
  onModelNameChange: (value: string) => void;
  onModelEnabledChange: (value: boolean) => void;
  onSaveModel: () => void;
  onDeleteModel: () => void;
}

function ModelsTab({
  providers,
  models,
  selectedModelId,
  modelProviderId,
  modelName,
  modelEnabled,
  usageReport,
  isLoading,
  onSelectModel,
  onAddModel,
  onModelProviderChange,
  onModelNameChange,
  onModelEnabledChange,
  onSaveModel,
  onDeleteModel,
}: ModelsTabProps) {
  return (
    <div className="ai-manager-grid">
      <aside className="ai-manager-list" aria-label="Models">
        <div className="ai-list-header">
          <h3>Models</h3>
          <button className="secondary-button" type="button" onClick={onAddModel}>
            Add
          </button>
        </div>
        {models.length === 0 ? (
          <p className="muted">No models yet.</p>
        ) : (
          models.map((model) => (
            <button
              key={model.id}
              className={`ai-list-item ${selectedModelId === model.id ? "selected" : ""}`}
              type="button"
              onClick={() => onSelectModel(model.id)}
            >
              <strong>{model.modelName}</strong>
              <span>{providerLabel(providers, model.providerId)}</span>
              <small>{model.isEnabled ? "Enabled" : "Disabled"}</small>
            </button>
          ))
        )}
      </aside>

      <section className="ai-properties">
        <UsageSummary dimension="model" report={usageReport} />
        <PanelTitle title="Properties" subtitle="Model name and provider binding." />
        <div className="ai-form-grid">
          <label className="ai-field">
            <span>Provider</span>
            <select
              value={modelProviderId}
              onChange={(event) => onModelProviderChange(event.target.value)}
              disabled={providers.length === 0 || Boolean(selectedModelId)}
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
            <input value={modelName} onChange={(event) => onModelNameChange(event.target.value)} />
          </label>
          <label className="ai-check-field">
            <input
              type="checkbox"
              checked={modelEnabled}
              onChange={(event) => onModelEnabledChange(event.target.checked)}
            />
            Enabled
          </label>
        </div>
        <div className="ai-settings-actions">
          <button className="primary-button" type="button" disabled={isLoading} onClick={onSaveModel}>
            Save Model
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={isLoading || !selectedModelId}
            onClick={onDeleteModel}
          >
            Delete
          </button>
        </div>

        <section className="ai-result-panel">
          <PanelTitle title="Result" subtitle="Model save operations update this local registry." />
          <p className="muted">
            {selectedModelId
              ? "This model can be assigned to Summary, Translation, or Tag agents."
              : "Create a model after adding a provider."}
          </p>
        </section>
      </section>
    </div>
  );
}

interface AgentsTabProps {
  models: AiModel[];
  activeAgent: AgentPanelType;
  summaryModelId: string;
  summaryLanguage: string;
  summaryDetailLevel: SummaryDetailLevel;
  translationModelId: string;
  translationLanguage: string;
  translationConcurrency: number;
  translationStrategy: TranslationPromptStrategy;
  taggingModelId: string;
  usageReport?: UsageReportResult;
  isLoading: boolean;
  onActiveAgentChange: (agent: AgentPanelType) => void;
  onSummaryModelChange: (modelId: string) => void;
  onSummaryLanguageChange: (value: string) => void;
  onSummaryDetailLevelChange: (value: SummaryDetailLevel) => void;
  onTranslationModelChange: (modelId: string) => void;
  onTranslationLanguageChange: (value: string) => void;
  onTranslationConcurrencyChange: (value: number) => void;
  onTranslationStrategyChange: (value: TranslationPromptStrategy) => void;
  onTaggingModelChange: (modelId: string) => void;
  onSaveAgent: (agent: AgentPanelType) => void;
}

function AgentsTab({
  models,
  activeAgent,
  summaryModelId,
  summaryLanguage,
  summaryDetailLevel,
  translationModelId,
  translationLanguage,
  translationConcurrency,
  translationStrategy,
  taggingModelId,
  usageReport,
  isLoading,
  onActiveAgentChange,
  onSummaryModelChange,
  onSummaryLanguageChange,
  onSummaryDetailLevelChange,
  onTranslationModelChange,
  onTranslationLanguageChange,
  onTranslationConcurrencyChange,
  onTranslationStrategyChange,
  onTaggingModelChange,
  onSaveAgent,
}: AgentsTabProps) {
  return (
    <div className="ai-manager-grid">
      <aside className="ai-manager-list" aria-label="Agents">
        {(["summary", "translation", "tagging"] as AgentPanelType[]).map((agent) => (
          <button
            key={agent}
            className={`ai-list-item ${activeAgent === agent ? "selected" : ""}`}
            type="button"
            onClick={() => onActiveAgentChange(agent)}
          >
            <strong>{agentLabel(agent)}</strong>
            <span>{agentDescription(agent)}</span>
          </button>
        ))}
      </aside>

      <section className="ai-properties">
        <UsageSummary dimension="agent" report={usageReport} />
        <PanelTitle title={`${agentLabel(activeAgent)} Properties`} subtitle="Choose the model and defaults used by this agent." />
        {activeAgent === "summary" ? (
          <div className="ai-form-grid">
            <ModelSelect label="Model" models={models} value={summaryModelId} onChange={onSummaryModelChange} />
            <LanguageSelect label="Default language" value={summaryLanguage} onChange={onSummaryLanguageChange} />
            <label className="ai-field">
              <span>Detail level</span>
              <select
                value={summaryDetailLevel}
                onChange={(event) => onSummaryDetailLevelChange(event.target.value as SummaryDetailLevel)}
              >
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="detailed">Detailed</option>
              </select>
            </label>
          </div>
        ) : null}

        {activeAgent === "translation" ? (
          <div className="ai-form-grid">
            <ModelSelect label="Model" models={models} value={translationModelId} onChange={onTranslationModelChange} />
            <LanguageSelect label="Default language" value={translationLanguage} onChange={onTranslationLanguageChange} />
            <label className="ai-field">
              <span>Concurrency</span>
              <input
                type="number"
                min={1}
                max={8}
                value={translationConcurrency}
                onChange={(event) => onTranslationConcurrencyChange(Number(event.target.value))}
              />
            </label>
            <label className="ai-field">
              <span>Prompt strategy</span>
              <select
                value={translationStrategy}
                onChange={(event) => onTranslationStrategyChange(event.target.value as TranslationPromptStrategy)}
              >
                <option value="standard">Standard</option>
                <option value="hy_mt_optimized">HY-MT optimized</option>
              </select>
            </label>
          </div>
        ) : null}

        {activeAgent === "tagging" ? (
          <div className="ai-form-grid">
            <ModelSelect label="Model" models={models} value={taggingModelId} onChange={onTaggingModelChange} />
          </div>
        ) : null}

        <div className="ai-settings-actions">
          <button
            className="primary-button"
            type="button"
            disabled={isLoading}
            onClick={() => onSaveAgent(activeAgent)}
          >
            Save {agentLabel(activeAgent)}
          </button>
        </div>
      </section>
    </div>
  );
}

interface UsageSummaryProps {
  dimension: UsageDimension;
  report?: UsageReportResult;
}

function UsageSummary({ dimension, report }: UsageSummaryProps) {
  const gradientId = `usageGradient-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const visibleReport = report?.dimension === dimension ? report : undefined;
  const dailyRows = buildUsageDailyRows(visibleReport);
  const points = buildUsageChartPoints(dailyRows);
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const topRows = visibleReport?.rows.slice(0, 3) ?? [];
  const activeItemCount = visibleReport?.rows.length ?? 0;

  return (
    <section className="ai-usage-panel">
      <div className="ai-usage-hero">
        <div className="usage-icon" aria-hidden="true">
          <LineChart size={20} />
        </div>
        <div className="model-call-title">
          <p className="eyebrow">7-day usage</p>
          <h3>{dimensionLabel(dimension)} Activity</h3>
          <p>
            Recent AI calls grouped by {dimensionLabel(dimension).toLowerCase()}.
          </p>
        </div>
      </div>

      <div className="usage-stat-grid">
        <div className="usage-stat-card">
          <span>Requests</span>
          <strong>{formatCompactNumber(visibleReport?.totalRequests ?? 0)}</strong>
        </div>
        <div className="usage-stat-card">
          <span>Tokens</span>
          <strong>{formatCompactNumber(visibleReport?.totalTokens ?? 0)}</strong>
        </div>
        <div className="usage-stat-card">
          <span>Active</span>
          <strong>{formatCompactNumber(activeItemCount)}</strong>
        </div>
      </div>

      <div className="usage-chart" aria-label="Daily token usage">
        <svg viewBox="0 0 320 112" role="img">
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2f6f7c" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#2f6f7c" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="usage-grid-line" d="M18 16 H304" />
          <path className="usage-grid-line" d="M18 56 H304" />
          <path className="usage-grid-line" d="M18 96 H304" />
          <polygon
            className="usage-area"
            fill={`url(#${gradientId})`}
            points={`18,96 ${linePoints} 304,96`}
          />
          <polyline className="usage-line" points={linePoints} />
          {points.map((point) => (
            <circle key={`${point.label}-${point.x}`} className="usage-point" cx={point.x} cy={point.y} r="3" />
          ))}
        </svg>
        <div className="usage-axis">
          {dailyRows.map((row) => (
            <span key={row.date}>{formatUsageDay(row.date)}</span>
          ))}
        </div>
      </div>

      <div className="usage-leaders" aria-label="Top usage rows">
        {topRows.length === 0 ? (
          <p className="muted">No usage events yet.</p>
        ) : (
          topRows.map((row) => (
            <div className="usage-leader-row" key={row.key}>
              <span>{row.label}</span>
              <strong>{formatCompactNumber(row.totalTokens)} tokens</strong>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="ai-panel-title">
      <h3>{title}</h3>
      <p>{subtitle}</p>
    </div>
  );
}

function ModelSelect({
  label,
  models,
  value,
  onChange,
}: {
  label: string;
  models: AiModel[];
  value: string;
  onChange: (modelId: string) => void;
}) {
  return (
    <label className="ai-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select model</option>
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
  );
}

function LanguageSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="ai-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="zh-Hans">简体中文</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}

function providerLabel(providers: AiProvider[], providerId: string) {
  return providers.find((provider) => provider.id === providerId)?.displayName ?? providerId;
}

function buildUsageDailyRows(report?: UsageReportResult) {
  if (report?.dailyRows && report.dailyRows.length > 0) {
    return report.dailyRows;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = new Date();
  return Array.from({ length: report?.windowDays ?? 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - ((report?.windowDays ?? 7) - index - 1));
    return {
      date: formatter.format(date),
      requestCount: 0,
      totalTokens: 0,
    };
  });
}

function buildUsageChartPoints(rows: ReturnType<typeof buildUsageDailyRows>) {
  const maxTokens = Math.max(1, ...rows.map((row) => row.totalTokens));
  const count = Math.max(rows.length - 1, 1);
  return rows.map((row, index) => ({
    label: row.date,
    x: 18 + (286 / count) * index,
    y: 96 - (row.totalTokens / maxTokens) * 80,
  }));
}

function formatUsageDay(value: string) {
  const parts = value.split("-");
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}`;
  }
  return value;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function tabUsageDimension(tab: AiSettingsTab): UsageDimension {
  if (tab === "providers") {
    return "provider";
  }
  if (tab === "models") {
    return "model";
  }
  return "agent";
}

function agentLabel(agent: AgentPanelType) {
  if (agent === "summary") {
    return "Summary";
  }
  if (agent === "translation") {
    return "Translation";
  }
  return "Tag";
}

function agentDescription(agent: AgentPanelType) {
  if (agent === "summary") {
    return "Article summary generation";
  }
  if (agent === "translation") {
    return "Reader translation workflow";
  }
  return "Tag suggestion workflow";
}

function dimensionLabel(dimension: UsageDimension) {
  if (dimension === "provider") {
    return "Provider";
  }
  if (dimension === "model") {
    return "Model";
  }
  return "Agent";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong.";
}
