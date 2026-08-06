#!/usr/bin/env node
/** Investigate precise URL review issue counts — dev diagnostics helper. */
const base = process.argv[2] ?? "http://localhost:3000";

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function runCase(label, payload) {
  const startedAt = Date.now();
  console.info(`\n=== ${label} ===`);
  console.info("request:", JSON.stringify(payload));

  const post = await fetch(`${base}/api/reviews/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const postBody = await post.json();
  if (!post.ok || !postBody.reviewId) {
    throw new Error(`${label} POST failed: ${post.status} ${JSON.stringify(postBody)}`);
  }

  const reviewId = postBody.reviewId;
  for (;;) {
    const res = await fetch(`${base}/api/reviews/url/${reviewId}`);
    const body = await res.json();
    if (body.status === "processing") {
      await sleep(2500);
      continue;
    }
    if (body.status === "error") {
      throw new Error(`${label} error: ${JSON.stringify(body.error)}`);
    }

    const report = body.report;
    const debug = body._debug;
    const totalMs = Date.now() - startedAt;

    console.info("result:", {
      reviewId,
      totalMs,
      reviewMode: report?.reviewMode,
      reviewLens: report?.reviewLens,
      issueCount: report?.issues?.length ?? null,
      limitationCount: report?.limitations?.length ?? null,
      limitations: report?.limitations,
      quality: report?.quality,
      insightSummaryLen: report?.insight?.summary?.length ?? 0,
      debugAiIssueCount: debug?.aiIssueCount,
      debugRenderedIssueCount: debug?.renderedIssueCount,
      debugWasRewritten: debug?.diagnostics?.wasRewritten,
      debugCropCount: debug?.diagnostics?.cropCount,
      debugPrincipleTagged: debug?.diagnostics?.principleTaggedIssueCount,
      issueTitles: report?.issues?.map((i) => i.title) ?? [],
    });
    return { label, reviewId, report, debug, totalMs };
  }
}

const cases = [
  [
    "precise+norman+example.com",
    {
      url: "example.com",
      deviceType: "desktop",
      reviewMode: "precise",
      reviewLens: "norman",
      externalProcessingConsent: true,
    },
  ],
  [
    "precise+general+example.com",
    {
      url: "example.com",
      deviceType: "desktop",
      reviewMode: "precise",
      reviewLens: "general",
      externalProcessingConsent: true,
    },
  ],
  [
    "precise+norman+wikipedia.org",
    {
      url: "en.wikipedia.org/wiki/Main_Page",
      deviceType: "desktop",
      reviewMode: "precise",
      reviewLens: "norman",
      externalProcessingConsent: true,
    },
  ],
];

const results = [];
for (const [label, payload] of cases) {
  results.push(await runCase(label, payload));
}

console.info("\n=== SUMMARY ===");
for (const r of results) {
  console.info(r.label, {
    totalMs: r.totalMs,
    aiIssueCount: r.debug?.aiIssueCount,
    rendered: r.report?.issues?.length,
    wasRewritten: r.debug?.diagnostics?.wasRewritten,
    cropCount: r.debug?.diagnostics?.cropCount,
  });
}
