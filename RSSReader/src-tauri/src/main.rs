#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::error::Error;

use rssreader_backend as backend;
use rssreader_backend::ai::{
    AiAgentSettings, AiModel, AiModelListResult, AiProvider, AiProviderListResult,
    ArticleSummaryRecord, AssignTagsRequest, CreateAiModelRequest, CreateAiProviderRequest,
    GetSummaryRequest, PromptRevealResult, ProviderTestRequest, ProviderTestResult,
    StartSummaryRequest, StartTranslationRequest, SummaryStreamChunk, TaggingSuggestRequest,
    TaggingSuggestResult, TranslationStreamChunk, TranslationView, UpdateAiModelRequest,
    UpdateAiProviderRequest, UsageReportResult,
};
use rssreader_backend::{
    ArticleDetail, ArticleListFilter, ArticleListResult, ArticleNote, ArticleTagsResult,
    FeedListResult, FeedRefreshResult, FeedWithArticles, TagListResult,
};
use tauri::{Emitter, Manager};

async fn run_blocking<T>(
    operation: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String>
where
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(operation)
        .await
        .map_err(|error| format!("Background task failed: {error}"))?
}

#[tauri::command]
fn feed_list() -> FeedListResult {
    backend::feeds::feed_list()
}

#[tauri::command]
fn tag_list() -> TagListResult {
    backend::feeds::tag_list()
}

#[tauri::command]
fn tag_rename(tag_id: String, name: String) -> Result<TagListResult, String> {
    backend::feeds::tag_rename(tag_id, name)
}

#[tauri::command]
fn tag_merge(source_tag_id: String, target_tag_id: String) -> Result<TagListResult, String> {
    backend::feeds::tag_merge(source_tag_id, target_tag_id)
}

#[tauri::command]
fn tag_delete(tag_id: String) -> Result<TagListResult, String> {
    backend::feeds::tag_delete(tag_id)
}

#[tauri::command]
async fn feed_add(url: String, name: Option<String>) -> Result<FeedWithArticles, String> {
    run_blocking(move || backend::feeds::feed_add(url, name)).await
}

#[tauri::command]
async fn feed_refresh(feed_id: String) -> Result<FeedRefreshResult, String> {
    run_blocking(move || backend::feeds::feed_refresh(feed_id)).await
}

#[tauri::command]
fn feed_delete(feed_id: String) -> Result<(), String> {
    backend::feeds::feed_delete(feed_id)
}

#[tauri::command]
fn article_list(filter: ArticleListFilter) -> ArticleListResult {
    backend::feeds::article_list(filter)
}

#[tauri::command]
fn article_get(article_id: String) -> Result<ArticleDetail, String> {
    backend::feeds::article_get(article_id)
}

#[tauri::command]
fn article_mark_read(article_id: String, is_read: bool) -> Result<(), String> {
    backend::feeds::article_mark_read(article_id, is_read)
}

#[tauri::command]
fn article_mark_favorite(article_id: String, is_favorite: bool) -> Result<(), String> {
    backend::feeds::article_mark_favorite(article_id, is_favorite)
}

#[tauri::command]
fn article_list_tags(article_id: String) -> ArticleTagsResult {
    backend::feeds::article_list_tags(article_id)
}

#[tauri::command]
fn article_save_tags(
    article_id: String,
    tags: Vec<String>,
    source: String,
) -> Result<ArticleTagsResult, String> {
    backend::feeds::article_save_tags(article_id, tags, source)
}

#[tauri::command]
fn article_delete_tag(article_id: String, tag_id: String) -> Result<(), String> {
    backend::feeds::article_delete_tag(article_id, tag_id)
}

#[tauri::command]
fn article_get_note(article_id: String) -> Option<ArticleNote> {
    backend::feeds::article_get_note(article_id)
}

#[tauri::command]
fn article_save_note(article_id: String, content: String) -> Result<ArticleNote, String> {
    backend::feeds::article_save_note(article_id, content)
}

#[tauri::command]
fn ai_list_providers() -> Result<AiProviderListResult, String> {
    backend::ai::ai_list_providers()
}

#[tauri::command]
fn ai_create_provider(request: CreateAiProviderRequest) -> Result<AiProvider, String> {
    backend::ai::ai_create_provider(request)
}

#[tauri::command]
fn ai_update_provider(
    provider_id: String,
    request: UpdateAiProviderRequest,
) -> Result<AiProvider, String> {
    backend::ai::ai_update_provider(provider_id, request)
}

#[tauri::command]
fn ai_delete_provider(provider_id: String) -> Result<(), String> {
    backend::ai::ai_delete_provider(provider_id)
}

#[tauri::command]
fn ai_list_models() -> Result<AiModelListResult, String> {
    backend::ai::ai_list_models()
}

#[tauri::command]
fn ai_create_model(request: CreateAiModelRequest) -> Result<AiModel, String> {
    backend::ai::ai_create_model(request)
}

#[tauri::command]
fn ai_update_model(model_id: String, request: UpdateAiModelRequest) -> Result<AiModel, String> {
    backend::ai::ai_update_model(model_id, request)
}

#[tauri::command]
fn ai_delete_model(model_id: String) -> Result<(), String> {
    backend::ai::ai_delete_model(model_id)
}

#[tauri::command]
async fn ai_test_provider(request: ProviderTestRequest) -> Result<ProviderTestResult, String> {
    run_blocking(move || backend::ai::ai_test_provider(request)).await
}

#[tauri::command]
fn ai_get_agent_settings(agent: String) -> Result<AiAgentSettings, String> {
    backend::ai::ai_get_agent_settings(agent)
}

#[tauri::command]
fn ai_update_agent_settings(settings: AiAgentSettings) -> Result<AiAgentSettings, String> {
    backend::ai::ai_update_agent_settings(settings)
}

#[tauri::command]
fn ai_reveal_prompt(agent: String) -> Result<PromptRevealResult, String> {
    backend::ai::ai_reveal_prompt(agent)
}

#[tauri::command]
fn ai_get_summary(request: GetSummaryRequest) -> Result<Option<ArticleSummaryRecord>, String> {
    backend::ai::ai_get_summary(request)
}

#[tauri::command]
async fn ai_start_summary(request: StartSummaryRequest) -> Result<SummaryStreamChunk, String> {
    run_blocking(move || backend::ai::ai_start_summary(request)).await
}

#[tauri::command]
fn ai_get_translation(
    article_id: String,
    target_language: String,
) -> Result<Option<TranslationView>, String> {
    backend::ai::ai_get_translation(article_id, target_language)
}

#[tauri::command]
async fn ai_start_translation(
    app_handle: tauri::AppHandle,
    request: StartTranslationRequest,
    event_id: Option<String>,
) -> Result<TranslationView, String> {
    run_blocking(move || {
        let Some(event_id) = event_id else {
            return backend::ai::ai_start_translation(request);
        };

        let event_name = translation_stream_event_name(&event_id);
        let emit_handle = app_handle.clone();
        let result = backend::ai::ai_start_translation_stream(request, |view| {
            let chunk = TranslationStreamChunk {
                translation: Some(view.clone()),
                done: view.status != "running",
                error_message: None,
            };
            if let Err(error) = emit_handle.emit(&event_name, chunk) {
                eprintln!("translation stream emit failed: {error}");
            }
        });

        if let Err(message) = &result {
            let chunk = TranslationStreamChunk {
                translation: None,
                done: true,
                error_message: Some(message.clone()),
            };
            let _ = app_handle.emit(&event_name, chunk);
        }

        result
    })
    .await
}

#[tauri::command]
async fn ai_suggest_tags(request: TaggingSuggestRequest) -> Result<TaggingSuggestResult, String> {
    run_blocking(move || backend::ai::ai_suggest_tags(request)).await
}

#[tauri::command]
fn ai_assign_tags(request: AssignTagsRequest) -> Result<ArticleTagsResult, String> {
    backend::ai::ai_assign_tags(request)
}

#[tauri::command]
fn ai_usage_report(
    dimension: String,
    window_days: u32,
    key: Option<String>,
) -> Result<UsageReportResult, String> {
    backend::ai::ai_usage_report(dimension, window_days, key)
}

fn configure_data_dir(app: &mut tauri::App) -> Result<(), Box<dyn Error>> {
    let app_data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_data_dir)?;

    let db_path = app_data_dir.join("vortex.sqlite3");
    std::env::set_var("RSSREADER_DATA_DIR", &app_data_dir);
    std::env::set_var("RSSREADER_DB_PATH", db_path);

    Ok(())
}

fn translation_stream_event_name(event_id: &str) -> String {
    format!("ai-translation-stream-{event_id}")
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            configure_data_dir(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            feed_list,
            tag_list,
            tag_rename,
            tag_merge,
            tag_delete,
            feed_add,
            feed_refresh,
            feed_delete,
            article_list,
            article_get,
            article_mark_read,
            article_mark_favorite,
            article_list_tags,
            article_save_tags,
            article_delete_tag,
            article_get_note,
            article_save_note,
            ai_list_providers,
            ai_create_provider,
            ai_update_provider,
            ai_delete_provider,
            ai_list_models,
            ai_create_model,
            ai_update_model,
            ai_delete_model,
            ai_test_provider,
            ai_get_agent_settings,
            ai_update_agent_settings,
            ai_reveal_prompt,
            ai_get_summary,
            ai_start_summary,
            ai_get_translation,
            ai_start_translation,
            ai_suggest_tags,
            ai_assign_tags,
            ai_usage_report
        ])
        .run(tauri::generate_context!())
        .expect("error while running Vortex");
}
