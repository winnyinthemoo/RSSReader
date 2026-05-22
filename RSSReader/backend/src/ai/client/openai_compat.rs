use std::time::Duration;

use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};

use super::super::error::{AiError, AiResult};
use super::super::model::ProviderTestResult;

const LLM_HTTP_TIMEOUT: Duration = Duration::from_secs(60);

pub struct OpenAiCompatClient {
    base_url: String,
    api_key: String,
    http: Client,
}

impl OpenAiCompatClient {
    pub fn new(base_url: String, api_key: String) -> Self {
        let http = Client::builder()
            .timeout(LLM_HTTP_TIMEOUT)
            .build()
            .unwrap_or_else(|_| Client::new());
        Self {
            base_url,
            api_key,
            http,
        }
    }

    pub fn ping(&self, model: &str) -> AiResult<ProviderTestResult> {
        let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));
        let body = ChatRequest {
            model: model.to_string(),
            messages: vec![ChatMessage {
                role: "user".to_string(),
                content: "ping".to_string(),
            }],
            max_tokens: Some(5),
            stream: Some(false),
        };

        let response = self
            .http
            .post(url)
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .map_err(|error| AiError::LlmRequest(error.to_string()))?;

        if response.status().is_success() {
            return Ok(ProviderTestResult {
                ok: true,
                message: "Connection succeeded".to_string(),
            });
        }

        let status = response.status();
        let message = response
            .text()
            .unwrap_or_else(|_| "Unknown error".to_string());
        Ok(ProviderTestResult {
            ok: false,
            message: format!("HTTP {status}: {message}"),
        })
    }

    pub fn chat_completion(&self, model: &str, messages: &[ChatMessage]) -> AiResult<String> {
        let url = format!("{}/chat/completions", self.base_url.trim_end_matches('/'));
        let body = ChatRequest {
            model: model.to_string(),
            messages: messages.to_vec(),
            max_tokens: None,
            stream: Some(false),
        };

        let response = self
            .http
            .post(url)
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .map_err(|error| AiError::LlmRequest(error.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let message = response
                .text()
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(AiError::LlmRequest(format!("HTTP {status}: {message}")));
        }

        let payload: ChatResponse = response
            .json()
            .map_err(|error| AiError::LlmRequest(format!("Invalid LLM JSON: {error}")))?;
        parse_chat_response(payload)
    }
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

fn parse_chat_response(payload: ChatResponse) -> AiResult<String> {
    payload
        .choices
        .first()
        .map(|choice| choice.message.content.clone())
        .ok_or_else(|| AiError::LlmRequest("Empty LLM response".to_string()))
}
