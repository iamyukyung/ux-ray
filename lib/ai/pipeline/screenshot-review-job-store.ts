import type { PipelineStage } from "@/lib/ai/pipeline/pipeline-stage";
import type { ScreenshotReviewAnalysisResult } from "@/lib/ai/screenshot-review-server";
import { SCREENSHOT_ANALYSIS_STEPS } from "@/lib/analysis-steps";

export type ScreenshotReviewJobStatus = "processing" | "done" | "error";

export interface ScreenshotReviewJob {
  id: string;
  status: ScreenshotReviewJobStatus;
  stage: PipelineStage;
  stepIndex: number;
  createdAt: number;
  updatedAt: number;
  result?: ScreenshotReviewAnalysisResult;
  error?: {
    code: string;
    message: string;
    stage?: PipelineStage;
  };
}

const JOB_TTL_MS = 30 * 60 * 1000;
const LAST_STEP_INDEX = SCREENSHOT_ANALYSIS_STEPS.length - 1;

/**
 * 스크린샷·URL AI 리뷰 공용 비동기 job store.
 * POST /api/reviews/screenshots · POST /api/reviews/url 가 job을 생성하고
 * GET .../[reviewId] 폴링으로 상태를 조회합니다.
 *
 * Fine-grained PipelineStage -> step index mapping.
 * If Critic requests a rewrite, reviewer-request/parse can fire a second time;
 * updateScreenshotReviewJobStage clamps stepIndex so it never moves backward.
 */
const STAGE_STEP_INDEX: Record<PipelineStage, number> = {
  "request-validation": 0,
  "image-metadata": 0,
  "image-preprocessing": 0,
  "image-cropping": 0,
  "observer-request": 0,
  "observer-parse": 0,
  "reviewer-request": 1,
  "reviewer-parse": 2,
  "critic-request": 3,
  "critic-parse": 3,
  "report-assembly": 4,
};

/**
 * Next.js 개발 서버는 라우트별로 별도 모듈 그래프를 컴파일할 수 있어,
 * 모듈 스코프의 평범한 Map은 POST/GET 라우트 간에 공유되지 않을 수 있습니다.
 * globalThis에 고정해 프로세스 전체에서 항상 같은 Map 인스턴스를 쓰도록 합니다.
 */
const GLOBAL_KEY = Symbol.for("ux-ray.screenshotReviewJobStore");

type GlobalWithJobStore = typeof globalThis & {
  [GLOBAL_KEY]?: Map<string, ScreenshotReviewJob>;
};

const globalForJobStore = globalThis as GlobalWithJobStore;

const jobs: Map<string, ScreenshotReviewJob> =
  globalForJobStore[GLOBAL_KEY] ?? new Map<string, ScreenshotReviewJob>();

globalForJobStore[GLOBAL_KEY] = jobs;

function sweepExpiredJobs(now: number): void {
  for (const [id, job] of jobs) {
    if (now - job.updatedAt > JOB_TTL_MS) jobs.delete(id);
  }
}

export function createScreenshotReviewJob(id: string): ScreenshotReviewJob {
  const now = Date.now();
  sweepExpiredJobs(now);

  const job: ScreenshotReviewJob = {
    id,
    status: "processing",
    stage: "request-validation",
    stepIndex: 0,
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(id, job);
  return job;
}

export function updateScreenshotReviewJobStage(id: string, stage: PipelineStage): void {
  const job = jobs.get(id);
  if (!job || job.status !== "processing") return;

  job.stage = stage;
  job.stepIndex = Math.max(job.stepIndex, STAGE_STEP_INDEX[stage] ?? 0);
  job.updatedAt = Date.now();
}

export function completeScreenshotReviewJob(
  id: string,
  result: ScreenshotReviewAnalysisResult
): void {
  const job = jobs.get(id);
  if (!job) return;

  job.status = "done";
  job.stepIndex = Math.max(job.stepIndex, LAST_STEP_INDEX);
  job.result = result;
  job.updatedAt = Date.now();
}

export function failScreenshotReviewJob(
  id: string,
  error: {
    code: string;
    message: string;
    stage?: PipelineStage;
  }
): void {
  const job = jobs.get(id);
  if (!job) return;

  job.status = "error";
  job.error = error;
  job.updatedAt = Date.now();
}

export function setScreenshotReviewJobStepIndex(id: string, stepIndex: number): void {
  const job = jobs.get(id);
  if (!job || job.status !== "processing") return;
  job.stepIndex = Math.max(job.stepIndex, stepIndex);
  job.updatedAt = Date.now();
}

export function getScreenshotReviewJob(id: string): ScreenshotReviewJob | undefined {
  return jobs.get(id);
}
