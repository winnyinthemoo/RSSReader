use std::fmt;

#[derive(Debug, Clone)]
pub enum AiError {
    NotImplemented(&'static str),
    NotFound(String),
    InvalidInput(String),
    Configuration(String),
    Provider(String),
    LlmRequest(String),
    Prompt(String),
    Database(String),
}

impl fmt::Display for AiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotImplemented(feature) => write!(f, "Not implemented: {feature}"),
            Self::NotFound(message) => write!(f, "{message}"),
            Self::InvalidInput(message) => write!(f, "{message}"),
            Self::Configuration(message) => write!(f, "{message}"),
            Self::Provider(message) => write!(f, "{message}"),
            Self::LlmRequest(message) => write!(f, "{message}"),
            Self::Prompt(message) => write!(f, "{message}"),
            Self::Database(message) => write!(f, "{message}"),
        }
    }
}

impl AiError {
    pub fn into_message(self) -> String {
        self.to_string()
    }
}

impl From<String> for AiError {
    fn from(value: String) -> Self {
        Self::Database(value)
    }
}

impl From<rusqlite::Error> for AiError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Database(error.to_string())
    }
}

pub type AiResult<T> = Result<T, AiError>;
