import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type DesktopStatus = {
  serviceInstalled: boolean;
  serviceRunning: boolean;
  dnsProxyRunning: boolean;
  configPath: string;
};

type DomainResult = "idle" | "blocked" | "allowed" | "error";

export function App() {
  const [status, setStatus] = useState<DesktopStatus | null>(null);
  const [domain, setDomain] = useState("example.com");
  const [domainResult, setDomainResult] = useState<DomainResult>("idle");

  useEffect(() => {
    invoke<DesktopStatus>("get_status")
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  async function testDomain() {
    setDomainResult("idle");
    try {
      const blocked = await invoke<boolean>("test_domain", { domain });
      setDomainResult(blocked ? "blocked" : "allowed");
    } catch {
      setDomainResult("error");
    }
  }

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">LibreAscent Desktop</p>
        <h1>Windows protection</h1>
        <dl className="status-grid">
          <div>
            <dt>Service installed</dt>
            <dd>{status?.serviceInstalled ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt>Service running</dt>
            <dd>{status?.serviceRunning ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt>DNS proxy</dt>
            <dd>{status?.dnsProxyRunning ? "Running" : "Stopped"}</dd>
          </div>
        </dl>
        <p className="path">
          {status?.configPath ?? "Config path unavailable"}
        </p>
      </section>

      <section className="panel">
        <h2>Domain test</h2>
        <div className="domain-row">
          <input
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
          />
          <button onClick={testDomain}>Test</button>
        </div>
        <p className={`result result-${domainResult}`}>{domainResult}</p>
      </section>
    </main>
  );
}
