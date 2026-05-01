use std::collections::HashSet;

#[derive(Debug, Clone, Default)]
pub struct DomainBlocklist {
    blocked: HashSet<String>,
    allowed: HashSet<String>,
}

impl DomainBlocklist {
    pub fn new(blocked: impl IntoIterator<Item = String>, allowed: impl IntoIterator<Item = String>) -> Self {
        let blocked = blocked
            .into_iter()
            .filter_map(|domain| normalize_domain(&domain))
            .collect();
        let allowed = allowed
            .into_iter()
            .filter_map(|domain| normalize_domain(&domain))
            .collect();

        Self { blocked, allowed }
    }

    pub fn is_blocked(&self, domain: &str) -> bool {
        let Some(normalized) = normalize_domain(domain) else {
            return false;
        };

        if matches_domain_set(&normalized, &self.allowed) {
            return false;
        }

        matches_domain_set(&normalized, &self.blocked)
    }
}

pub fn normalize_domain(input: &str) -> Option<String> {
    let trimmed = input.trim().to_ascii_lowercase();
    let domain = trimmed
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .trim_end_matches('.');

    let host = domain.split('/').next().unwrap_or("").trim();

    if host.is_empty() || host.contains(' ') {
        None
    } else {
        Some(host.to_string())
    }
}

fn matches_domain_set(domain: &str, set: &HashSet<String>) -> bool {
    if set.contains(domain) {
        return true;
    }

    let mut remainder = domain;
    while let Some((_, parent)) = remainder.split_once('.') {
        if set.contains(parent) {
            return true;
        }
        remainder = parent;
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_domains() {
        assert_eq!(normalize_domain(" HTTPS://Sub.Example.COM/path "), Some("sub.example.com".to_string()));
        assert_eq!(normalize_domain("example.com."), Some("example.com".to_string()));
        assert_eq!(normalize_domain("bad domain.com"), None);
    }

    #[test]
    fn blocks_exact_and_subdomains() {
        let blocklist = DomainBlocklist::new(vec!["example.com".to_string()], Vec::<String>::new());

        assert!(blocklist.is_blocked("example.com"));
        assert!(blocklist.is_blocked("www.example.com"));
        assert!(blocklist.is_blocked("deep.www.example.com"));
        assert!(!blocklist.is_blocked("example.org"));
    }

    #[test]
    fn allowlist_wins_over_blocklist() {
        let blocklist = DomainBlocklist::new(
            vec!["example.com".to_string()],
            vec!["safe.example.com".to_string()],
        );

        assert!(blocklist.is_blocked("example.com"));
        assert!(!blocklist.is_blocked("safe.example.com"));
        assert!(!blocklist.is_blocked("cdn.safe.example.com"));
    }
}
