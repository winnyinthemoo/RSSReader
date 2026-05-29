use super::super::client::openai_compat::ChatMessage;
use super::template_store::PromptRenderResult;

/// Build OpenAI-compatible messages from rendered prompts (Mercury: omit system when absent).
pub fn chat_messages_from_rendered(rendered: &PromptRenderResult) -> Vec<ChatMessage> {
    let mut messages = Vec::new();
    if let Some(system) = rendered.system.as_ref() {
        let trimmed = system.trim();
        if !trimmed.is_empty() {
            messages.push(ChatMessage {
                role: "system".to_string(),
                content: trimmed.to_string(),
            });
        }
    }
    messages.push(ChatMessage {
        role: "user".to_string(),
        content: rendered.user.clone(),
    });
    messages
}
