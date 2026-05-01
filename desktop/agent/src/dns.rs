use anyhow::Result;
use std::path::PathBuf;

pub async fn run_local_dns_proxy(_config_path: PathBuf, bind_addr: &str) -> Result<()> {
    println!("DNS proxy would listen on {bind_addr}");
    Ok(())
}
