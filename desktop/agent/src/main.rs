mod config_loader;
mod dns;

use anyhow::{bail, Result};
use libreascent_shared::blocklist::DomainBlocklist;
use libreascent_shared::config::default_config_path;

#[tokio::main]
async fn main() -> Result<()> {
    let args = std::env::args().skip(1).collect::<Vec<_>>();

    match args.first().map(String::as_str) {
        Some("check-domain") => {
            let Some(domain) = args.get(1) else {
                bail!("usage: libreascent-agent check-domain <domain>");
            };
            let config = config_loader::load_or_create(&default_config_path())?;
            let blocklist = DomainBlocklist::new(config.included_domains, config.excluded_domains);
            println!("{}", if blocklist.is_blocked(domain) { "blocked" } else { "allowed" });
        }
        Some("run-dns") => {
            dns::run_local_dns_proxy(default_config_path(), "127.0.0.1:5353").await?;
        }
        _ => {
            println!("usage:");
            println!("  libreascent-agent check-domain <domain>");
            println!("  libreascent-agent run-dns");
        }
    }

    Ok(())
}
