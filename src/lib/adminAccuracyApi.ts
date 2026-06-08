import { authClient } from "./auth-client";
import { formatApiError } from "./formatApiError";

const ADMIN_HEADER_SECRET = "xevodev";

export type AccuracyTestDef = {
  id: string;
  title: string;
  description: string;
  scriptHint?: string;
};

export type AccuracyTestRun = {
  id: string;
  testId: string;
  scorePercent: number;
  passed: boolean;
  summary: string;
  detail?: Record<string, unknown> | null;
  createdAt: string;
};

function adminHeaders() {
  return { "X-Admin-Train-Secret": ADMIN_HEADER_SECRET };
}

async function parseJson<T>(res: unknown): Promise<T> {
  const data = ((res as { data?: T })?.data ?? res) as T & { error?: unknown };
  if (data && typeof data === "object" && "error" in data && data.error != null) {
    throw new Error(formatApiError(data.error, "Request failed"));
  }
  return data;
}

export async function fetchAccuracyCatalog(): Promise<{
  passThresholdPercent: number;
  tests: AccuracyTestDef[];
}> {
  const res = await authClient
    .$fetch<{
      passThresholdPercent?: number;
      tests?: AccuracyTestDef[];
      error?: unknown;
    }>("/train/admin/accuracy/tests", {
      method: "GET",
      headers: adminHeaders(),
    })
    .catch((err) => ({ error: formatApiError(err, "Request failed") }));
  const data = await parseJson<{
    passThresholdPercent: number;
    tests: AccuracyTestDef[];
  }>(res);
  return {
    passThresholdPercent: data.passThresholdPercent ?? 60,
    tests: data.tests ?? [],
  };
}

export async function fetchAccuracyHistory(testId?: string): Promise<{
  runs: AccuracyTestRun[];
  latestByTest: Record<string, AccuracyTestRun>;
}> {
  const q = testId ? `?testId=${encodeURIComponent(testId)}&limit=30` : "?limit=40";
  const res = await authClient
    .$fetch<{
      runs?: AccuracyTestRun[];
      latestByTest?: Record<string, AccuracyTestRun>;
      error?: unknown;
    }>(`/train/admin/accuracy/history${q}`, {
      method: "GET",
      headers: adminHeaders(),
    })
    .catch((err) => ({ error: formatApiError(err, "Request failed") }));
  const data = await parseJson<{
    runs: AccuracyTestRun[];
    latestByTest: Record<string, AccuracyTestRun>;
  }>(res);
  return {
    runs: data.runs ?? [],
    latestByTest: data.latestByTest ?? {},
  };
}

export async function runAccuracyTest(testId: string): Promise<{
  runId: string;
  testId: string;
  scorePercent: number;
  passed: boolean;
  summary: string;
  detail?: Record<string, unknown>;
}> {
  const res = await authClient
    .$fetch<{
      runId?: string;
      testId?: string;
      scorePercent?: number;
      passed?: boolean;
      summary?: string;
      detail?: Record<string, unknown>;
      error?: unknown;
    }>(`/train/admin/accuracy/run/${encodeURIComponent(testId)}`, {
      method: "POST",
      headers: adminHeaders(),
    })
    .catch((err) => ({ error: formatApiError(err, "Test failed") }));
  const data = await parseJson<{
    runId: string;
    testId: string;
    scorePercent: number;
    passed: boolean;
    summary: string;
    detail?: Record<string, unknown>;
  }>(res);
  if (data.scorePercent == null) throw new Error("Invalid test response");
  return data;
}

export async function runAllAccuracyTests(): Promise<{
  results: { testId: string; runId: string; scorePercent: number; passed: boolean }[];
}> {
  const res = await authClient
    .$fetch<{
      results?: { testId: string; runId: string; scorePercent: number; passed: boolean }[];
      error?: unknown;
    }>("/train/admin/accuracy/run-all", {
      method: "POST",
      headers: adminHeaders(),
    })
    .catch((err) => ({ error: formatApiError(err, "Run all failed") }));
  return parseJson<{ results: { testId: string; runId: string; scorePercent: number; passed: boolean }[] }>(
    res
  );
}
