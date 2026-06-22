import { authClient } from "./auth-client";
import { formatApiError } from "./formatApiError";

const ADMIN_HEADER_SECRET = "xevodev";

export type BenchStepDef = {
  id: string;
  title: string;
  order: number;
};

export type BenchSubmission = {
  analysisId: string;
  username: string;
  createdAt: string;
  shot: string;
  score: number | null;
  videoUrl: string;
  hasMesh: boolean;
  embedding_source: string | null;
};

export type BenchStepResult = {
  runId?: string;
  stepId: string;
  title: string;
  passed: boolean;
  scorePercent: number;
  summary: string;
  evidence: Record<string, unknown>;
  failures: Array<Record<string, unknown>>;
  tables: Record<string, unknown>;
  charts: Record<string, unknown>;
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

export async function fetchBenchSteps(): Promise<{
  passThresholdPercent: number;
  steps: BenchStepDef[];
}> {
  const res = await authClient
    .$fetch<{
      passThresholdPercent?: number;
      steps?: BenchStepDef[];
      error?: unknown;
    }>("/train/admin/accuracy/bench/steps", {
      method: "GET",
      headers: adminHeaders(),
    })
    .catch((err) => ({ error: formatApiError(err, "Request failed") }));
  const data = await parseJson<{ passThresholdPercent: number; steps: BenchStepDef[] }>(res);
  return {
    passThresholdPercent: data.passThresholdPercent ?? 60,
    steps: data.steps ?? [],
  };
}

export async function fetchBenchSubmissions(search?: string): Promise<BenchSubmission[]> {
  const q = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  const res = await authClient
    .$fetch<{ items?: BenchSubmission[]; error?: unknown }>(
      `/train/admin/accuracy/bench/submissions${q}`,
      { method: "GET", headers: adminHeaders() }
    )
    .catch((err) => ({ error: formatApiError(err, "Request failed") }));
  const data = await parseJson<{ items: BenchSubmission[] }>(res);
  return data.items ?? [];
}

export async function runBenchStep(
  stepId: string,
  body?: { analysisId?: string; blendMeshWeight?: number }
): Promise<BenchStepResult> {
  const res = await authClient
    .$fetch<BenchStepResult & { error?: unknown }>(
      `/train/admin/accuracy/bench/run/${encodeURIComponent(stepId)}`,
      {
        method: "POST",
        headers: adminHeaders(),
        body: body ?? {},
      }
    )
    .catch((err) => ({ error: formatApiError(err, "Bench step failed") }));
  const data = await parseJson<BenchStepResult>(res);
  if (data.scorePercent == null) throw new Error("Invalid bench response");
  return data;
}
