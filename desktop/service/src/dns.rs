use anyhow::{Context, Result};
use hickory_proto::op::{Message, MessageType, OpCode, ResponseCode};
use hickory_proto::serialize::binary::{BinDecodable, BinEncodable};
use libreascent_shared::blocklist::DomainBlocklist;
use std::net::SocketAddr;
use std::path::PathBuf;
use tokio::net::UdpSocket;
use tokio::sync::oneshot;
use tokio::time::{timeout, Duration};

use crate::config_loader;

const UPSTREAM_DNS: &[&str] = &["1.1.1.1:53", "8.8.8.8:53", "1.0.0.1:53"];
const UPSTREAM_TIMEOUT: Duration = Duration::from_secs(2);
const LOCAL_PROXY_TIMEOUT: Duration = Duration::from_secs(5);

pub async fn run_local_dns_proxy(config_path: PathBuf, bind_addr: &str) -> Result<()> {
    run_local_dns_proxy_with_ready(config_path, bind_addr, None).await
}

pub async fn run_local_dns_proxy_with_ready(
    config_path: PathBuf,
    bind_addr: &str,
    ready: Option<oneshot::Sender<Result<(), String>>>,
) -> Result<()> {
    let bind: SocketAddr = bind_addr.parse().context("invalid DNS bind address")?;

    let mut upstreams = Vec::new();
    for addr in UPSTREAM_DNS {
        if let Ok(sa) = addr.parse::<SocketAddr>() {
            upstreams.push(sa);
        }
    }

    let socket = match UdpSocket::bind(bind)
        .await
        .context("failed to bind DNS proxy")
    {
        Ok(socket) => {
            if let Some(sender) = ready {
                let _ = sender.send(Ok(()));
            }
            socket
        }
        Err(error) => {
            if let Some(sender) = ready {
                let _ = sender.send(Err(error.to_string()));
            }
            return Err(error);
        }
    };
    let upstream_socket = UdpSocket::bind("0.0.0.0:0")
        .await
        .context("failed to bind upstream DNS socket")?;
    let broadcast_socket = UdpSocket::bind("127.0.0.1:0").await.ok();
    let mut buffer = vec![0_u8; 4096];

    loop {
        let (size, peer) = match socket.recv_from(&mut buffer).await {
            Ok(res) => res,
            Err(e) if e.kind() == std::io::ErrorKind::ConnectionReset => {
                // Ignore ConnectionReset on Windows (caused by ICMP Port Unreachable from previous send_to)
                continue;
            }
            Err(e) => return Err(e).context("failed to receive DNS packet"),
        };
        let request = buffer[..size].to_vec();
        let request_id = get_request_id(&request);
        let blocklist = config_loader::load_blocklist(&config_path);
        match build_block_response_if_needed(&request, &blocklist) {
            Ok(Some(response)) => {
                crate::dns_manager::log_tamper_event(&format!("Blocked: {request_id:04x}"));
                let _ = socket.send_to(&response, peer).await;

                if let Some(ref b_socket) = broadcast_socket {
                    let _ = b_socket.send_to(b"block:dns", "127.0.0.1:13370").await;
                }
                continue;
            }
            Ok(None) => {}
            Err(error) => {
                crate::dns_manager::log_tamper_event(&format!(
                    "Invalid DNS request ignored: {error}"
                ));
                continue;
            }
        }

        match forward_to_upstreams(&upstream_socket, &request, &upstreams, &mut buffer).await {
            Ok(upstream_size) => {
                crate::dns_manager::log_tamper_event(&format!("Resolved: {request_id:04x}"));
                let _ = socket.send_to(&buffer[..upstream_size], peer).await;
            }
            Err(error) => {
                if let Ok(response) = build_error_response(&request, ResponseCode::ServFail) {
                    let _ = socket.send_to(&response, peer).await;
                }
                crate::dns_manager::log_tamper_event(&format!("Failed: {request_id:04x} - {error}"));
            }
        }
    }
}

fn get_request_id(request: &[u8]) -> u16 {
    if request.len() < 2 {
        0
    } else {
        u16::from_be_bytes([request[0], request[1]])
    }
}

async fn forward_to_upstreams(
    upstream_socket: &UdpSocket,
    request: &[u8],
    upstreams: &[SocketAddr],
    buffer: &mut [u8],
) -> Result<usize> {
    let mut last_error = None;

    for upstream in upstreams {
        if let Err(e) = upstream_socket.send_to(request, *upstream).await {
            last_error = Some(anyhow::anyhow!("failed to send to {upstream}: {e}"));
            continue;
        }

        loop {
            match timeout(UPSTREAM_TIMEOUT, upstream_socket.recv_from(buffer)).await {
                Ok(Ok((upstream_size, _))) => return Ok(upstream_size),
                Ok(Err(e)) if e.kind() == std::io::ErrorKind::ConnectionReset => {
                    continue;
                }
                Ok(Err(e)) => {
                    last_error = Some(anyhow::anyhow!("failed to receive from {upstream}: {e}"));
                    break;
                }
                Err(_) => {
                    last_error = Some(anyhow::anyhow!("timed out waiting for {upstream}"));
                    break;
                }
            }
        }
    }

    Err(last_error.unwrap_or_else(|| anyhow::anyhow!("no upstreams available")))
}

pub async fn local_dns_proxy_responds() -> Result<bool> {
    let socket = UdpSocket::bind("127.0.0.1:0")
        .await
        .context("failed to bind local DNS health-check socket")?;
    let request = dns_probe_query()?;

    socket
        .send_to(&request, "127.0.0.1:53")
        .await
        .context("failed to send local DNS health-check query")?;

    let mut buffer = vec![0_u8; 512];
    loop {
        match timeout(LOCAL_PROXY_TIMEOUT, socket.recv_from(&mut buffer)).await {
            Ok(Ok((size, _))) => {
                return Message::from_bytes(&buffer[..size])
                    .map(|response| response.id() == 0x4c41)
                    .context("failed to parse local DNS health-check response")
            }
            Ok(Err(e)) if e.kind() == std::io::ErrorKind::ConnectionReset => {
                // Ignore ConnectionReset on Windows (likely ICMP port unreachable from a previous probe)
                continue;
            }
            Ok(Err(error)) => {
                return Err(error).context("failed to receive local DNS health-check response")
            }
            Err(_) => return Ok(false),
        }
    }
}

fn dns_probe_query() -> Result<Vec<u8>> {
    use hickory_proto::op::Query;
    use hickory_proto::rr::{Name, RecordType};

    let mut message = Message::new();
    message.set_id(0x4c41);
    message.set_message_type(MessageType::Query);
    message.set_recursion_desired(true);
    message.add_query(Query::query(
        Name::from_ascii("pornhub.com.").context("failed to build DNS health-check name")?,
        RecordType::A,
    ));
    message
        .to_bytes()
        .context("failed to encode DNS health-check query")
}

pub fn build_block_response_if_needed(
    request: &[u8],
    blocklist: &DomainBlocklist,
) -> Result<Option<Vec<u8>>> {
    let message = Message::from_bytes(request).context("failed to parse DNS request")?;
    let Some(query) = message.queries().first() else {
        return Ok(None);
    };
    let domain = query.name().to_ascii();

    if !blocklist.is_blocked(&domain) {
        return Ok(None);
    }

    build_error_response(request, ResponseCode::NXDomain).map(Some)
}

pub fn build_error_response(request: &[u8], response_code: ResponseCode) -> Result<Vec<u8>> {
    let message = Message::from_bytes(request).context("failed to parse DNS request")?;
    let mut response = Message::new();
    response.set_id(message.id());
    response.set_message_type(MessageType::Response);
    response.set_op_code(OpCode::Query);
    response.set_authoritative(false);
    response.set_recursion_desired(message.recursion_desired());
    response.set_recursion_available(true);
    response.set_response_code(response_code);

    if let Some(query) = message.queries().first() {
        response.add_query(query.clone());
    }

    response
        .to_bytes()
        .context("failed to encode DNS error response")
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

        let response =
            build_block_response_if_needed(&request, &blocklist).expect("request should parse");

        assert!(response.is_none());
    }

    #[test]
    fn returns_servfail_for_upstream_failure() {
        let request = dns_query("allowed.com.");

        let response_bytes =
            build_error_response(&request, ResponseCode::ServFail).expect("request should parse");
        let response = Message::from_bytes(&response_bytes).expect("response should parse");

        assert_eq!(response.response_code(), ResponseCode::ServFail);
        assert_eq!(response.queries().len(), 1);
    }

    #[test]
    fn builds_valid_dns_probe_query() {
        let request = dns_probe_query().expect("query should encode");
        let message = Message::from_bytes(&request).expect("query should parse");

        assert_eq!(message.id(), 0x4c41);
        assert_eq!(message.queries().len(), 1);
        assert_eq!(message.queries()[0].name().to_ascii(), "cloudflare.com.");
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
