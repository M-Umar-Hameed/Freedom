pub fn normalize_domain(input: &str) -> Option<String> {
    let trimmed = input.trim().trim_end_matches('.').to_ascii_lowercase();

    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}
