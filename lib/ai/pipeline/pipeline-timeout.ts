import type { PipelineStage } from "@/lib/ai/pipeline/pipeline-stage";

export const CRITIC_MIN_REMAINING_MS = 45_000;

export class PipelineTimeoutError extends Error {
  readonly stage: PipelineStage;

  constructor(stage: PipelineStage) {
    super(`Pipeline timeout at stage: ${stage}`);
    this.name = "PipelineTimeoutError";
    this.stage = stage;
  }
}

export interface PipelineDeadlineContext {
  signal: AbortSignal;
  deadlineAt: number;
  cleanup: () => void;
  assertNotAborted: (stage: PipelineStage) => void;
  ensureTimeForStage: (stage: PipelineStage, minRemainingMs: number) => void;
  getRemainingMs: () => number;
}

export function createPipelineDeadlineContext(timeoutMs: number): PipelineDeadlineContext {
  const controller = new AbortController();
  const deadlineAt = Date.now() + timeoutMs;

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    deadlineAt,
    cleanup: () => {
      clearTimeout(timeoutId);
    },
    assertNotAborted(stage: PipelineStage) {
      if (controller.signal.aborted || Date.now() >= deadlineAt) {
        throw new PipelineTimeoutError(stage);
      }
    },
    ensureTimeForStage(stage: PipelineStage, minRemainingMs: number) {
      const remainingMs = deadlineAt - Date.now();
      if (controller.signal.aborted || remainingMs < minRemainingMs) {
        throw new PipelineTimeoutError(stage);
      }
    },
    getRemainingMs() {
      return Math.max(0, deadlineAt - Date.now());
    },
  };
}

export function isPipelineTimeoutError(error: unknown): error is PipelineTimeoutError {
  return error instanceof PipelineTimeoutError;
}
