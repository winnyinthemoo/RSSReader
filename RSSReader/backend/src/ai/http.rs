//! Dev-server HTTP routing for `/api/ai/*` (skeleton).

use std::io::Write;
use std::net::TcpStream;

use super::commands::*;
use super::model::*;

pub fn try_handle(method: &str, path: &str, body: &str, stream: &mut TcpStream) -> bool {
    if !path.starts_with("/api/ai") {
        return false;
    }

    let path_with_query = path;
    let path = path_without_query(path);

    match (method, path) {
        ("GET", "/api/ai/providers") => {
            respond(stream, ai_list_providers());
        }
        ("POST", "/api/ai/providers") => {
            let payload = parse_json_body::<CreateAiProviderRequest>(body);
            respond(
                stream,
                payload.and_then(|request| ai_create_provider(request)),
            );
        }
        ("PUT", path) if provider_id_from_path(path).is_some() => {
            let provider_id = provider_id_from_path(path).unwrap();
            let payload = parse_json_body::<UpdateAiProviderRequest>(body);
            respond(
                stream,
                payload.and_then(|request| ai_update_provider(provider_id, request)),
            );
        }
        ("DELETE", path) if provider_id_from_path(path).is_some() => {
            let provider_id = provider_id_from_path(path).unwrap();
            match ai_delete_provider(provider_id) {
                Ok(()) => write_json(stream, 200, r#"{"ok":true}"#),
                Err(message) => write_json(stream, 400, &error_json(&message)),
            }
        }
        ("GET", "/api/ai/models") => {
            respond(stream, ai_list_models());
        }
        ("POST", "/api/ai/models") => {
            let payload = parse_json_body::<CreateAiModelRequest>(body);
            respond(stream, payload.and_then(|request| ai_create_model(request)));
        }
        ("PUT", path) if model_id_from_path(path).is_some() => {
            let model_id = model_id_from_path(path).unwrap();
            let payload = parse_json_body::<UpdateAiModelRequest>(body);
            respond(
                stream,
                payload.and_then(|request| ai_update_model(model_id, request)),
            );
        }
        ("DELETE", path) if model_id_from_path(path).is_some() => {
            let model_id = model_id_from_path(path).unwrap();
            match ai_delete_model(model_id) {
                Ok(()) => write_json(stream, 200, r#"{"ok":true}"#),
                Err(message) => write_json(stream, 400, &error_json(&message)),
            }
        }
        ("POST", "/api/ai/providers/test") => {
            let payload = parse_json_body::<ProviderTestRequest>(body);
            respond(
                stream,
                payload.and_then(|request| ai_test_provider(request)),
            );
        }
        ("GET", path) if path.starts_with("/api/ai/settings/") => {
            let agent = path
                .trim_start_matches("/api/ai/settings/")
                .trim_end_matches('/');
            respond(stream, ai_get_agent_settings(agent.to_string()));
        }
        ("PUT", path) if path.starts_with("/api/ai/settings/") => {
            let payload = parse_json_body::<AiAgentSettings>(body);
            respond(
                stream,
                payload.and_then(|settings| ai_update_agent_settings(settings)),
            );
        }
        ("POST", path) if path.starts_with("/api/ai/prompts/reveal/") => {
            let agent = path.trim_start_matches("/api/ai/prompts/reveal/");
            respond(stream, ai_reveal_prompt(agent.to_string()));
        }
        ("GET", "/api/ai/summary") => {
            let article_id = query_param(path_with_query, "articleId").unwrap_or_default();
            let target_language = query_param(path_with_query, "targetLanguage")
                .unwrap_or_else(|| "zh-Hans".to_string());
            let detail_level = query_param(path_with_query, "detailLevel")
                .and_then(|value| parse_detail_level(&value))
                .unwrap_or(SummaryDetailLevel::Medium);
            respond(
                stream,
                ai_get_summary(GetSummaryRequest {
                    article_id,
                    target_language,
                    detail_level,
                }),
            );
        }
        ("POST", "/api/ai/summary/stream") => match parse_json_body::<StartSummaryRequest>(body) {
            Ok(request) => {
                if let Err(error) = write_summary_stream(stream, request) {
                    eprintln!("summary stream write failed: {error}");
                }
            }
            Err(message) => write_json(stream, 400, &error_json(&message)),
        },
        ("GET", "/api/ai/translation") => {
            let article_id = query_param(path_with_query, "articleId").unwrap_or_default();
            let target_language = query_param(path_with_query, "targetLanguage")
                .unwrap_or_else(|| "zh-Hans".to_string());
            respond(stream, ai_get_translation(article_id, target_language));
        }
        ("POST", "/api/ai/translation/start") => {
            let payload = parse_json_body::<StartTranslationRequest>(body);
            respond(
                stream,
                payload.and_then(|request| ai_start_translation(request)),
            );
        }
        ("POST", "/api/ai/translation/stream") => {
            match parse_json_body::<StartTranslationRequest>(body) {
                Ok(request) => {
                    if let Err(error) = write_translation_stream(stream, request) {
                        eprintln!("translation stream write failed: {error}");
                    }
                }
                Err(message) => write_json(stream, 400, &error_json(&message)),
            }
        }
        ("POST", "/api/ai/translation/retry-segment") => {
            let payload = parse_json_body::<RetryTranslationSegmentRequest>(body);
            respond(
                stream,
                payload.and_then(|request| ai_retry_translation_segment(request)),
            );
        }
        ("POST", "/api/ai/tagging/suggest") => {
            let payload = parse_json_body::<TaggingSuggestRequest>(body);
            respond(stream, payload.and_then(|request| ai_suggest_tags(request)));
        }
        ("POST", "/api/ai/tagging/assign") | ("POST", "/api/ai/tags/assign") => {
            let payload = parse_json_body::<AssignTagsRequest>(body);
            respond(stream, payload.and_then(|request| ai_assign_tags(request)));
        }
        ("GET", "/api/ai/usage/report") => {
            let dimension =
                query_param(path_with_query, "dimension").unwrap_or_else(|| "agent".to_string());
            let window_days = query_param(path_with_query, "windowDays")
                .and_then(|value| value.parse().ok())
                .unwrap_or(7);
            let key = query_param(path_with_query, "key");
            respond(stream, ai_usage_report(dimension, window_days, key));
        }
        ("POST", "/api/ai/usage/clear-expired") => {
            let retention_days = query_param(path_with_query, "retentionDays")
                .and_then(|value| value.parse().ok())
                .unwrap_or(30);
            respond(stream, ai_clear_expired_usage(retention_days));
        }
        ("POST", "/api/ai/usage/clear-all") => {
            respond(stream, ai_clear_all_usage());
        }
        _ => {
            write_json(
                stream,
                501,
                &serde_json::json!({ "message": format!("AI route not implemented: {method} {path}") })
                    .to_string(),
            );
        }
    }

    true
}

fn respond<T: serde::Serialize>(stream: &mut TcpStream, result: Result<T, String>) {
    match result {
        Ok(value) => match serde_json::to_string(&value) {
            Ok(json) => write_json(stream, 200, &json),
            Err(error) => write_json(stream, 500, &error_json(&error.to_string())),
        },
        Err(message) => write_json(stream, 400, &error_json(&message)),
    }
}

fn parse_json_body<T: serde::de::DeserializeOwned>(body: &str) -> Result<T, String> {
    if body.trim().is_empty() {
        return Err("Request body is required".to_string());
    }
    serde_json::from_str(body).map_err(|error| format!("Invalid JSON body: {error}"))
}

fn path_without_query(path: &str) -> &str {
    path.split('?').next().unwrap_or(path)
}

fn provider_id_from_path(path: &str) -> Option<String> {
    let path = path_without_query(path);
    let prefix = "/api/ai/providers/";
    let id = path.strip_prefix(prefix)?;
    if id.is_empty() || id.contains('/') {
        return None;
    }
    Some(url_decode(id))
}

fn model_id_from_path(path: &str) -> Option<String> {
    let path = path_without_query(path);
    let prefix = "/api/ai/models/";
    let id = path.strip_prefix(prefix)?;
    if id.is_empty() || id.contains('/') {
        return None;
    }
    Some(url_decode(id))
}

fn query_param(path: &str, key: &str) -> Option<String> {
    let query = path.split('?').nth(1)?;
    for pair in query.split('&') {
        let (k, v) = pair.split_once('=')?;
        if k == key {
            return Some(url_decode(v));
        }
    }
    None
}

fn parse_detail_level(value: &str) -> Option<SummaryDetailLevel> {
    match value {
        "short" => Some(SummaryDetailLevel::Short),
        "medium" => Some(SummaryDetailLevel::Medium),
        "detailed" => Some(SummaryDetailLevel::Detailed),
        _ => None,
    }
}

fn url_decode(value: &str) -> String {
    value.replace("%20", " ").replace("%2F", "/")
}

fn error_json(message: &str) -> String {
    serde_json::json!({ "message": message }).to_string()
}

const CORS_RESPONSE_HEADERS: &str = "\
Access-Control-Allow-Origin: *\r\n\
Access-Control-Allow-Headers: content-type\r\n\
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n";

fn write_json(stream: &mut TcpStream, status: u16, body: &str) {
    let status_text = match status {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        404 => "Not Found",
        _ => "Internal Server Error",
    };
    let response = format!(
        "HTTP/1.1 {status} {status_text}\r\nContent-Type: application/json\r\n{CORS_RESPONSE_HEADERS}Content-Length: {}\r\n\r\n{}",
        body.len(),
        body
    );

    let _ = stream.write_all(response.as_bytes());
}

fn write_summary_stream(
    stream: &mut TcpStream,
    request: StartSummaryRequest,
) -> std::io::Result<()> {
    let header = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/x-ndjson\r\nCache-Control: no-cache\r\nConnection: close\r\n{CORS_RESPONSE_HEADERS}\r\n"
    );
    stream.write_all(header.as_bytes())?;
    stream.flush()?;

    let result = ai_start_summary_stream(request, |chunk| {
        let _ = write_json_line(stream, chunk);
        let _ = stream.flush();
    });

    if let Err(message) = result {
        let chunk = SummaryStreamChunk {
            delta: String::new(),
            done: true,
            error_message: Some(message),
        };
        let _ = write_json_line(stream, &chunk);
        let _ = stream.flush();
    }

    Ok(())
}
fn write_translation_stream(
    stream: &mut TcpStream,
    request: StartTranslationRequest,
) -> std::io::Result<()> {
    let header = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/x-ndjson\r\nCache-Control: no-cache\r\nConnection: close\r\n{CORS_RESPONSE_HEADERS}\r\n"
    );
    stream.write_all(header.as_bytes())?;
    stream.flush()?;

    let result = ai_start_translation_stream(request, |view| {
        let chunk = TranslationStreamChunk {
            translation: Some(view.clone()),
            done: view.status != "running",
            error_message: None,
        };
        let _ = write_json_line(stream, &chunk);
        let _ = stream.flush();
    });

    if let Err(message) = result {
        let chunk = TranslationStreamChunk {
            translation: None,
            done: true,
            error_message: Some(message),
        };
        let _ = write_json_line(stream, &chunk);
        let _ = stream.flush();
    }

    Ok(())
}

fn write_json_line<T: serde::Serialize>(stream: &mut TcpStream, value: &T) -> std::io::Result<()> {
    let json = serde_json::to_string(value).map_err(std::io::Error::other)?;
    stream.write_all(json.as_bytes())?;
    stream.write_all(b"\n")?;
    Ok(())
}
