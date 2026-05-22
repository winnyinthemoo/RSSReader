import { useEffect, useState } from "react";

import type { UsageReportResult } from "../../../../../shared/ai";
import { getUsageReport } from "../../../services/aiService";

interface UsageReportPageProps {
  onClose: () => void;
}

export function UsageReportPage({ onClose }: UsageReportPageProps) {
  const [report, setReport] = useState<UsageReportResult | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    void loadReport();
  }, []);

  async function loadReport() {
    try {
      const result = await getUsageReport("agent", 7);
      setReport(result);
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load usage report");
    }
  }

  return (
    <div className="ai-settings-overlay" role="dialog" aria-label="Usage report">
      <section className="ai-settings-panel">
        <header className="ai-settings-header">
          <div>
            <p className="eyebrow">AI</p>
            <h2>Usage (7 days)</h2>
          </div>
          <button className="tool-button" type="button" onClick={onClose}>
            Close
          </button>
        </header>
        {report ? (
          <div className="ai-settings-body">
            <p>
              Total requests: {report.totalRequests} · Total tokens: {report.totalTokens}
            </p>
            {report.rows.length === 0 ? (
              <p className="muted">No usage events yet. Implement llm_usage_events write path.</p>
            ) : (
              <table className="usage-table">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Requests</th>
                    <th>Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      <td>{row.requestCount}</td>
                      <td>{row.totalTokens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : null}
        {errorMessage ? <p className="ai-status-error">{errorMessage}</p> : null}
      </section>
    </div>
  );
}
