use anyhow::{Context, Result};
use hickory_proto::op::{Message, MessageType, OpCode, ResponseCode};
use hickory_proto::serialize::binary::{BinDecodable, BinEncodable};
use libreascent_shared::blocklist::DomainBlocklist;
use std::net::SocketAddr;
use std::path::PathBuf;
use tokio::net::UdpSocket;

use crate::config_loader;

const UPSTREAM_DNS: &str = "1.1.1.1:53";

pub async fn run_local_dns_proxy(config_path: PathBuf, bind_addr: &str) -> Result<()> {
    let bind: SocketAddr = bind_addr.parse().context("invalid DNS bind address")?;
    let upstream: SocketAddr = UPSTREAM_DNS.parse().context("invalid upstream DNS address")?;
    let socket = UdpSocket::bind(bind).await.context("failed to bind DNS proxy")?;
    let upstream_socket = UdpSocket::bind("0.0.0.0:0").await.context("failed to bind upstream DNS socket")?;
    let mut buffer = vec![0_u8; 4096];

    loop {
        let (size, peer) = socket.recv_from(&mut buffer).await.context("failed to receive DNS packet")?;
        let request = &buffer[..size];
        let config = config_loader::load_or_create(&config_path)?;
        let blocklist = DomainBlocklist::new(config.included_domains, config.excluded_domains);

        if let Some(response) = build_block_response_if_needed(request, &blocklist)? {
            socket.send_to(&response, peer).await.context("failed to send blocked DNS response")?;
            continue;
        }

        upstream_socket
            .send_to(request, upstream)
            .await
            .context("failed to forward DNS request")?;
        let (upstream_size, _) = upstream_socket
            .recv_from(&mut buffer)
            .await
            .context("failed to receive upstream DNS response")?;
        socket
            .send_to(&buffer[..upstream_size], peer)
            .await
            .context("failed to send upstream DNS response")?;
    }
}

pub fn build_block_response_if_needed(request: &[u8], blocklist: &DomainBlocklist) -> Result<Option<Vec<u8>>> {
    let message = Message::from_bytes(request).context("failed to parse DNS request")?;
    let Some(query) = message.queries().first() else {
        return Ok(None);
    };
    let domain = query.name().to_ascii();

    if !blocklist.is_blocked(&domain) {
        return Ok(None);
    }

    let mut response = Message::new();
    response.set_id(message.id());
    response.set_message_type(MessageType::Response);
    response.set_op_code(OpCode::Query);
    response.set_authoritative(false);
    response.set_recursion_desired(message.recursion_desired());
    response.set_recursion_available(true);
    response.set_response_code(ResponseCode::NXDomain);
    response.add_query(query.clone());

    response.to_bytes().context("failed to encode blocked DNS response").map(Some)
}

#[cfg(test)]
mod tests {
    use super::*;
    use hickory_proto::op::Query;
    use hickory_proto::rr::{Name, RecordType};

    #[test]
    fn returns_nxdomain_for_blocked_domain() {
        let request = dns_query("example.com.");
        let blocklist = DomainBlocklist::new(vec!["example.com".to_string()], Vec::<String>::new());

        let response_bytes = build_block_response_if_needed(&request, &blocklist)
            .expect("request should parse")
            .expect("domain should be blocked");
        let response = Message::from_bytes(&response_bytes).expect("response should parse");

        assert_eq!(response.response_code(), ResponseCode::NXDomain);
        assert_eq!(response.queries().len(), 1);
    }

    #[test]
    fn returns_none_for_allowed_domain() {
        let request = dns_query("allowed.com.");
        let blocklist = DomainBlocklist::new(vec!["example.com".to_string()], Vec::<String>::new());

        let response = build_block_response_if_needed(&request, &blocklist).expect("request should parse");

        assert!(response.is_none());
    }

    fn dns_query(domain: &str) -> Vec<u8> {
        let mut message = Message::new();
        message.set_id(42);
        message.set_message_type(MessageType::Query);
        message.set_recursion_desired(true);
        message.add_query(Query::query(
            Name::from_ascii(domain).expect("domain should be valid"),
            RecordType::A,
        ));
        message.to_bytes().expect("query should encode")
    }
}
