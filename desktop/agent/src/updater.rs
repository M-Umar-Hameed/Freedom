use anyhow::{Context, Result};
use libreascent_shared::blocklist::parse_domain_list;
use std::fs;
use std::path::Path;

pub async fn update_sources(config_path: &Path) -> Result<()> {
    let config = crate::config_loader::load_or_create(config_path)
        .map_err(|e| anyhow::anyhow!("failed to load config: {}", e))?;
    let mut all_domains = Vec::new();

    for source in &config.sources {
        if !source.enabled {
            continue;
        }

        println!("Fetching {}...", source.name);
        let response = reqwest::get(&source.url)
            .await
            .with_context(|| format!("failed to fetch source {}", source.name))?;
        
        if !response.status().is_success() {
            println!("Warning: Failed to fetch {}: {}", source.name, response.status());
            continue;
        }

        let content = response.text().await.context("failed to read response text")?;
        let domains = parse_domain_list(&content);
        println!("  Found {} domains", domains.len());
        all_domains.extend(domains);
    }

    // Merge with manually included domains and remove duplicates
    all_domains.extend(config.included_domains.clone());
    all_domains.sort();
    all_domains.dedup();

    println!("Total unique domains: {}", all_domains.len());

    let blocklist_path = config_path.parent().unwrap().join("blocklist.txt");
    fs::write(&blocklist_path, all_domains.join("\n"))
        .with_context(|| format!("failed to write blocklist to {}", blocklist_path.display()))?;

    Ok(())
}
