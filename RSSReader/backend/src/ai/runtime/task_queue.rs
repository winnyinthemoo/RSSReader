//! Simplified task queue: one in-flight task per agent kind (Mercury-compatible skeleton).

use std::sync::Mutex;

use super::super::error::{AiError, AiResult};
use super::super::model::AgentType;

pub struct TaskQueue {
    active: Mutex<Option<ActiveTask>>,
}

#[derive(Debug, Clone)]
struct ActiveTask {
    agent_type: AgentType,
    article_id: String,
}

impl TaskQueue {
    pub fn new() -> Self {
        Self {
            active: Mutex::new(None),
        }
    }

    pub fn try_acquire(&self, agent_type: AgentType, article_id: &str) -> AiResult<()> {
        let mut guard = self
            .active
            .lock()
            .map_err(|_| AiError::Configuration("Task queue lock poisoned".to_string()))?;
        if let Some(task) = guard.as_ref() {
            if task.agent_type == agent_type && task.article_id != article_id {
                return Err(AiError::Configuration(
                    "Another task is already running for this agent".to_string(),
                ));
            }
        }
        *guard = Some(ActiveTask {
            agent_type,
            article_id: article_id.to_string(),
        });
        Ok(())
    }

    pub fn release(&self, agent_type: AgentType, article_id: &str) -> AiResult<()> {
        let mut guard = self
            .active
            .lock()
            .map_err(|_| AiError::Configuration("Task queue lock poisoned".to_string()))?;
        if guard
            .as_ref()
            .is_some_and(|task| task.agent_type == agent_type && task.article_id == article_id)
        {
            *guard = None;
        }
        Ok(())
    }
}
