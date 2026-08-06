#!/usr/bin/env node
/** Regression A–E for precise evidence target fix. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = process.argv[2] ?? "http://localhost:3000";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testImage = path.join(__dirname, "..", ".e2e-test.png");

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function pollUrl(payload, label) {
  const startedAt = Date.now();
  const post = await fetch(`${base}/api/reviews/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, externalProcessingConsent: true }),
  });
  const postBody = await post.json();
  if (!post.ok || !postBody.reviewId) {
    throw new Error(`${label} POST failed: ${JSON.stringify(postBody)}`);
  }

  for (;;) {
    const res = await fetch(`${base}/api/reviews/url/${postBody.reviewId}`);
    const body = await res.json();
    if (body.status === "processing") {
      await sleep(2500);
      continue;
    }
    if (body.status === "error") throw new Error(`${label} error: ${JSON.stringify(body.error)}`);
    return {
      label,
      reviewId: postBody.reviewId,
      totalMs: Date.now() - startedAt,
      report: body.report,
      debug: body._debug,
      aiCallsEstimate: estimatePreciseAiCalls(body._debug),
    };
  }
}

async function pollScreenshot(reviewMode, reviewLens, label) {
  const startedAt = Date.now();
  const form = new FormData();
  form.append(
    "metadata",
    JSON.stringify({
      reviewMode,
      reviewLens,
      projectName: "Regression",
      screens: [
        {
          id: "screen-reg-1",
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

  const post = await fetch(`${base}/api/reviews/screenshots`, { method: "POST", body: form });
  const postBody = await post.json();
  if (!post.ok) throw new Error(`${label} POST failed`);

  for (;;) {
    const res = await fetch(`${base}/api/reviews/screenshots/${postBody.reviewId}`);
    const body = await res.json();
    if (body.status === "processing") {
      await sleep(2500);
      continue;
    }
    if (body.status === "error") throw new Error(`${label} error: ${JSON.stringify(body.error)}`);
    return {
      label,
      reviewId: postBody.reviewId,
      totalMs: Date.now() - startedAt,
      report: body.report,
      debug: body._debug,
      aiCallsEstimate: reviewMode === "quick" ? 1 : estimatePreciseAiCalls(body._debug),
    };
  }
}

function estimatePreciseAiCalls(debug) {
  if (!debug?.diagnostics) return null;
  let calls = 1; // observer min 1 screen
  calls += 1; // reviewer
  calls += 1; // critic
  if (debug.diagnostics.wasRewritten) calls += 1;
  return calls;
}

function summarize(result) {
  const d = result.debug?.diagnostics;
  return {
    label: result.label,
    reviewId: result.reviewId,
    reviewMode: result.report?.reviewMode,
    reviewLens: result.report?.reviewLens,
    cropCount: d?.cropCount ?? result.report?.cropMetadata?.length ?? null,
    allowedTargetCount: null,
    rewriteAttempted: null,
    rewriteApplied: d?.wasRewritten ?? null,
    aiIssueCount: result.debug?.aiIssueCount,
    remappedToOverviewCount: null,
    droppedEvidenceCount: null,
    droppedIssueCount: null,
    renderedIssueCount: result.report?.issues?.length ?? 0,
    aiCallsEstimate: result.aiCallsEstimate,
    totalMs: result.totalMs,
    issueTitles: result.report?.issues?.map((i) => i.title) ?? [],
    cropIds: [
      ...new Set(
        (result.report?.issues ?? []).flatMap((issue) =>
          (issue.evidence ?? []).map((ev) => ev.cropId)
        )
      ),
    ],
  };
}

const results = [];

results.push(
  summarize(
    await pollUrl(
      {
        url: "example.com",
        deviceType: "desktop",
        reviewMode: "precise",
        reviewLens: "general",
      },
      "A-precise-general-example.com"
    )
  )
);

results.push(
  summarize(
    await pollUrl(
      {
        url: "example.com",
        deviceType: "desktop",
        reviewMode: "precise",
        reviewLens: "norman",
      },
      "B-precise-norman-example.com"
    )
  )
);

results.push(
  summarize(
    await pollUrl(
      {
        url: "https://developer.mozilla.org/en-US/docs/Web/HTML",
        deviceType: "desktop",
        reviewMode: "precise",
        reviewLens: "general",
      },
      "C-precise-general-mdn"
    )
  )
);

results.push(
  summarize(
    await pollScreenshot("quick", "general", "D-quick-screenshot")
  )
);

results.push(
  summarize(
    await pollScreenshot("precise", "general", "E-precise-screenshot")
  )
);

console.info("[regression:summary]", JSON.stringify(results, null, 2));
