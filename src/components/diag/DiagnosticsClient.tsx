"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type CheckStatus = "pending" | "pass" | "warn" | "fail";

type DiagCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  details: string;
};

type DiagApiResponse = {
  ok: boolean;
  serverTimeIso: string;
  build: {
    version: string;
    nodeEnv: string;
    deploymentUrl: string;
  };
};

const statusVariantMap: Record<CheckStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  pass: "default",
  warn: "secondary",
  fail: "destructive",
};

function statusLabel(status: CheckStatus) {
  if (status === "pass") return "PASS";
  if (status === "warn") return "WARN";
  if (status === "fail") return "FAIL";
  return "PENDING";
}

async function runFetchCheck(
  id: string,
  label: string,
  url: string,
  expected: number[] = [200, 204]
): Promise<DiagCheck> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "cache-control": "no-cache",
      },
    });

    if (expected.includes(response.status)) {
      return { id, label, status: "pass", details: `HTTP ${response.status}` };
    }
    return { id, label, status: "warn", details: `Unexpected status: HTTP ${response.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { id, label, status: "fail", details: `Request failed: ${message}` };
  }
}

function checkLocalStorage(): DiagCheck {
  const id = "local-storage";
  const label = "LocalStorage";
  try {
    const key = "__diag__";
    window.localStorage.setItem(key, "ok");
    window.localStorage.removeItem(key);
    return { id, label, status: "pass", details: "Read/write works" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unavailable";
    return { id, label, status: "fail", details: message };
  }
}

async function checkIndexedDB(): Promise<DiagCheck> {
  const id = "indexed-db";
  const label = "IndexedDB";
  if (!("indexedDB" in window)) {
    return { id, label, status: "fail", details: "indexedDB is not available" };
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open("diag-probe", 1);
      request.onerror = () => resolve({ id, label, status: "warn", details: "Open failed" });
      request.onsuccess = () => {
        request.result.close();
        resolve({ id, label, status: "pass", details: "Open/read works" });
      };
      request.onupgradeneeded = () => {
        resolve({ id, label, status: "pass", details: "Open/create works" });
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unavailable";
      resolve({ id, label, status: "fail", details: message });
    }
  });
}

async function checkServiceWorker(): Promise<DiagCheck> {
  const id = "service-worker";
  const label = "Service Worker";
  if (!("serviceWorker" in navigator)) {
    const insecureContext = typeof window !== "undefined" && !window.isSecureContext;
    return {
      id,
      label,
      status: insecureContext ? "warn" : "fail",
      details: insecureContext
        ? "Unavailable in non-secure context (expected on http://)"
        : "serviceWorker API unavailable",
    };
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const controller = Boolean(navigator.serviceWorker.controller);
    if (!registration) {
      return {
        id,
        label,
        status: "warn",
        details: `Supported, but no registration found (controller: ${controller ? "yes" : "no"})`,
      };
    }

    const details = [
      `scope=${registration.scope}`,
      `active=${registration.active ? "yes" : "no"}`,
      `waiting=${registration.waiting ? "yes" : "no"}`,
      `installing=${registration.installing ? "yes" : "no"}`,
      `controller=${controller ? "yes" : "no"}`,
    ].join(", ");
    return { id, label, status: "pass", details };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unavailable";
    return { id, label, status: "fail", details: message };
  }
}

export function DiagnosticsClient() {
  const [checks, setChecks] = useState<DiagCheck[]>([]);
  const [apiInfo, setApiInfo] = useState<DiagApiResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasFailures = useMemo(() => checks.some((c) => c.status === "fail"), [checks]);
  const hasWarnings = useMemo(() => checks.some((c) => c.status === "warn"), [checks]);

  const runDiagnostics = async () => {
    setRunning(true);
    setCopied(false);

    const initialChecks: DiagCheck[] = [
      {
        id: "online",
        label: "Browser online flag",
        status: navigator.onLine ? "pass" : "warn",
        details: navigator.onLine ? "navigator.onLine = true" : "navigator.onLine = false",
      },
      {
        id: "cache-api",
        label: "Cache API",
        status: "caches" in window ? "pass" : "warn",
        details: "caches" in window ? "Available" : "Not available",
      },
      checkLocalStorage(),
    ];
    setChecks(initialChecks);

    const [pingCheck, swFileCheck, manifestCheck, apiCheck, swRuntimeCheck, indexedDbCheck] = await Promise.all([
      runFetchCheck("ping", "/ping endpoint", `/ping?ts=${Date.now()}`, [204]),
      runFetchCheck("sw-file", "/sw.js", `/sw.js?ts=${Date.now()}`, [200]),
      runFetchCheck("manifest", "/manifest.webmanifest", `/manifest.webmanifest?ts=${Date.now()}`, [200]),
      runFetchCheck("diag-api", "/api/diag", `/api/diag?ts=${Date.now()}`, [200]),
      checkServiceWorker(),
      checkIndexedDB(),
    ]);

    try {
      const res = await fetch(`/api/diag?ts=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as DiagApiResponse;
        setApiInfo(data);

        const serverMs = new Date(data.serverTimeIso).getTime();
        const driftMs = Math.abs(Date.now() - serverMs);
        const driftMinutes = Math.round(driftMs / 60000);
        if (!Number.isNaN(serverMs) && driftMinutes >= 5) {
          initialChecks.push({
            id: "time-drift",
            label: "Device time drift",
            status: "warn",
            details: `Device time differs from server by ~${driftMinutes} min`,
          });
        } else {
          initialChecks.push({
            id: "time-drift",
            label: "Device time drift",
            status: "pass",
            details: "Device time is close to server time",
          });
        }
      }
    } catch {
      initialChecks.push({
        id: "time-drift",
        label: "Device time drift",
        status: "warn",
        details: "Could not compare device and server time",
      });
    }

    setChecks([
      ...initialChecks,
      pingCheck,
      swFileCheck,
      manifestCheck,
      apiCheck,
      swRuntimeCheck,
      indexedDbCheck,
    ]);
    setRunning(false);
  };

  const copyReport = async () => {
    const lines = [
      `Diagnostics generated: ${new Date().toISOString()}`,
      `URL: ${window.location.href}`,
      `User agent: ${navigator.userAgent}`,
      `Online: ${navigator.onLine}`,
      apiInfo
        ? `Build: version=${apiInfo.build.version}, nodeEnv=${apiInfo.build.nodeEnv}, deploy=${apiInfo.build.deploymentUrl}`
        : "Build: unknown",
      ...checks.map((c) => `${c.label}: ${statusLabel(c.status)} (${c.details})`),
    ];
    const report = lines.join("\n");
    await navigator.clipboard.writeText(report);
    setCopied(true);
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="h-[100dvh] overflow-y-auto p-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Diagnostics</CardTitle>
              <CardDescription>
                Run a quick health check for connectivity, PWA files, service worker, and build metadata.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={hasFailures ? "destructive" : hasWarnings ? "secondary" : "default"}>
                  {hasFailures ? "Issues detected" : hasWarnings ? "Warnings detected" : "No critical issues"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Use this screen when a user reports app load failures.
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={runDiagnostics} disabled={running}>
                  {running ? "Running checks..." : "Run diagnostics"}
                </Button>
                <Button variant="outline" onClick={copyReport} disabled={checks.length === 0}>
                  {copied ? "Copied" : "Copy report"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {apiInfo && (
            <Card>
              <CardHeader>
                <CardTitle>Build info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>Version: {apiInfo.build.version}</p>
                <p>Node env: {apiInfo.build.nodeEnv}</p>
                <p>Deployment URL: {apiInfo.build.deploymentUrl}</p>
                <p>Server time: {apiInfo.serverTimeIso}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Checks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {checks.length === 0 && (
                <p className="text-sm text-muted-foreground">No checks yet. Tap "Run diagnostics".</p>
              )}
              {checks.map((check) => (
                <div key={check.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{check.label}</p>
                    <p className="text-xs text-muted-foreground break-words">{check.details}</p>
                  </div>
                  <Badge variant={statusVariantMap[check.status]}>{statusLabel(check.status)}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
