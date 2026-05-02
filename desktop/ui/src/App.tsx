import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type DesktopStatus = {
  serviceInstalled: boolean;
  serviceRunning: boolean;
  dnsProxyRunning: boolean;
  dnsControlled: boolean;
  configPath: string;
  isAdmin: boolean;
};

type DomainResult = "idle" | "blocked" | "allowed" | "error";

export function App() {
  const [status, setStatus] = useState<DesktopStatus | null>(null);
  const [domain, setDomain] = useState("example.com");
  const [domainResult, setDomainResult] = useState<DomainResult>("idle");
  const [loading, setLoading] = useState(false);

  const refreshStatus = () => {
    invoke<DesktopStatus>("get_status")
      .then(setStatus)
      .catch(() => setStatus(null));
  };

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 5000);
    return () => clearInterval(interval);
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

  async function runAction(cmd: string) {
    setLoading(true);
    try {
      await invoke(cmd);
      refreshStatus();
    } catch (e) {
      alert(`Action failed: ${e}`);
    } finally {
      setLoading(false);
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
            <dt>System DNS</dt>
            <dd>{status?.dnsControlled ? "Managed" : "External"}</dd>
          </div>
        </dl>

        <div className="actions-row">
          {!status?.serviceInstalled ? (
            <button disabled={loading} onClick={() => runAction("install_service")}>
              Install Service
            </button>
          ) : (
            <>
              {!status?.serviceRunning ? (
                <button disabled={loading} onClick={() => runAction("start_service")}>
                  Start Service
                </button>
              ) : (
                <button disabled={loading} onClick={() => runAction("stop_service")}>
                  Stop Service
                </button>
              )}
              <button
                disabled={loading}
                className="btn-danger"
                onClick={() => runAction("uninstall_service")}
              >
                Uninstall
              </button>
            </>
          )}
        </div>

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
