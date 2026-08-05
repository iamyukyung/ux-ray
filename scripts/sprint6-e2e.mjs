#!/usr/bin/env node
/**
 * Sprint 6 E2E — API + legacy report checks.
 * Usage: node scripts/sprint6-e2e.mjs [--base http://localhost:3000]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "http://localhost:3000";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testImage = path.join(__dirname, "..", ".e2e-test.png");

const POLL_MS = 2500;
const MAX_WAIT_MS = 600_000;

function log(event, payload) {
  console.info(`[sprint6:e2e-progress] ${event}`, JSON.stringify(payload));
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollJob(kind, reviewId, startedAt) {
  const pollUrl =
    kind === "url"
      ? `${base}/api/reviews/url/${reviewId}`
      : `${base}/api/reviews/screenshots/${reviewId}`;

  while (Date.now() - startedAt < MAX_WAIT_MS) {
    const res = await fetch(pollUrl, { cache: "no-store" });
    const body = await res.json();

    if (body.status === "processing") {
      await sleep(POLL_MS);
      continue;
    }

    if (body.status === "error") {
      throw new Error(body.error?.message ?? body.error?.code ?? "job failed");
    }

    if (body.status === "done" && body.report) {
      return {
        report: body.report,
        debug: body._debug ?? body.debug,
        screenAssets: body.screenAssets ?? [],
        totalMs: Date.now() - startedAt,
      };
    }

    throw new Error(`unexpected poll status: ${JSON.stringify(body)}`);
  }

  throw new Error("poll timeout");
}

async function runUrlReview(reviewMode) {
  const startedAt = Date.now();
  const payload = {
    url: "example.com",
    deviceType: "desktop",
    reviewMode,
    reviewLens: "norman",
    externalProcessingConsent: true,
  };

  const post = await fetch(`${base}/api/reviews/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const postBody = await post.json();
  if (!post.ok || !postBody.reviewId) {
    throw new Error(`URL POST failed: ${post.status} ${JSON.stringify(postBody)}`);
  }

  const result = await pollJob("url", postBody.reviewId, startedAt);
  const report = result.report;

  return {
    kind: "url",
    reviewMode,
    reviewId: postBody.reviewId,
    totalMs: result.totalMs,
    reviewModeField: report.reviewMode,
    screenLayoutMode: report.screenLayoutMode,
    pipelineVersion: report.pipelineVersion,
    quality: report.quality,
    issueCount: report.issues?.length ?? 0,
    cropCount: report.cropMetadata?.length ?? 0,
    screenAssetCount: result.screenAssets.length,
    hasScreenAssets: result.screenAssets.length > 0,
    reviewLens: report.reviewLens,
    aiCallCountEstimate:
      reviewMode === "quick" ? 1 : result.debug?.diagnostics ? "precise-multi" : null,
  };
}

async function runScreenshotReview(reviewMode) {
  if (!fs.existsSync(testImage)) {
    throw new Error(`missing test image: ${testImage}`);
  }

  const startedAt = Date.now();
  const form = new FormData();
  form.append(
    "metadata",
    JSON.stringify({
      reviewMode,
      reviewLens: "norman",
      projectName: "E2E Test",
      userGoal: "",
      targetUser: "",
      focusArea: "",
      screens: [
        {
          id: "screen-e2e-1",
          screenName: "Login",
          order: 1,
          deviceType: "mobile",
          width: 390,
          height: 844,
        },
      ],
    })
  );
  form.append(
    "images",
    new Blob([fs.readFileSync(testImage)], { type: "image/png" }),
    "e2e-test.png"
  );

  const post = await fetch(`${base}/api/reviews/screenshots`, {
    method: "POST",
    body: form,
  });
  const postBody = await post.json();
  if (!post.ok || !postBody.reviewId) {
    throw new Error(`screenshot POST failed: ${post.status} ${JSON.stringify(postBody)}`);
  }

  const result = await pollJob("screenshots", postBody.reviewId, startedAt);
  const report = result.report;

  return {
    kind: "screenshot",
    reviewMode,
    reviewId: postBody.reviewId,
    totalMs: result.totalMs,
    reviewModeField: report.reviewMode,
    screenLayoutMode: report.screenLayoutMode,
    pipelineVersion: report.pipelineVersion,
    quality: report.quality,
    issueCount: report.issues?.length ?? 0,
    cropCount: report.cropMetadata?.length ?? 0,
    reviewLens: report.reviewLens,
  };
}

async function checkLegacyReport(id) {
  const res = await fetch(`${base}/review/${id}`, { redirect: "manual" });
  const html = await res.text();
  const ok = res.status === 200 && html.includes("Overall") || html.includes("Top Issues") || html.includes("AI");
  return {
    kind: "legacy",
    id,
    status: res.status,
    renders: ok,
    hasError: html.includes("TypeError") || html.includes("Application error"),
  };
}

const args = process.argv.slice(2);
const only = args.includes("--only")
  ? args[args.indexOf("--only") + 1]?.split(",")
  : null;

function shouldRun(name) {
  return !only || only.includes(name);
}

const results = [];

try {
  log("start", { base, only });

  for (const mode of ["quick", "precise"]) {
    const name = `url-${mode}`;
    if (!shouldRun(name)) continue;
    log("url-review-start", { reviewMode: mode });
    const r = await runUrlReview(mode);
    results.push(r);
    log("url-review-done", r);
  }

  for (const mode of ["quick", "precise"]) {
    const name = `screenshot-${mode}`;
    if (!shouldRun(name)) continue;
    log("screenshot-review-start", { reviewMode: mode });
    const r = await runScreenshotReview(mode);
    results.push(r);
    log("screenshot-review-done", r);
  }

  for (const id of ["demo-1", "demo-2"]) {
    const name = `legacy-${id}`;
    if (!shouldRun(name)) continue;
    log("legacy-report-start", { id });
    const r = await checkLegacyReport(id);
    results.push(r);
    log("legacy-report-done", r);
  }

  const failures = results.filter((r) => {
    if (r.kind === "legacy") return !r.renders || r.hasError;
    if (r.reviewModeField !== r.reviewMode) return true;
    if (r.reviewMode === "quick" && r.quality != null) return true;
    if (r.reviewMode === "precise" && r.quality == null) return true;
    if (r.kind === "url" && !r.hasScreenAssets) return true;
    if (r.issueCount < 1) return true;
    return false;
  });

  log("summary", { results, failureCount: failures.length });
  if (failures.length > 0) {
    console.error("[sprint6:e2e-progress] FAILURES", failures);
    process.exit(1);
  }

  log("complete", { pass: true, runCount: results.length });
} catch (error) {
  log("fatal", { message: error instanceof Error ? error.message : String(error) });
  process.exit(1);
}
