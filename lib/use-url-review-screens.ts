"use client";

import { useEffect, useState } from "react";
import {
  loadUrlReviewScreensFromStorage,
  revokeUploadedScreenUrls,
} from "@/lib/url-review-assets";
import type { ScreenshotReviewReport, UploadedScreen } from "@/lib/types";
import type { UrlAssetLoadState } from "@/components/landing/UrlCapturedPageSection";

export function useUrlReviewScreens(
  reviewId: string | null,
  report: ScreenshotReviewReport | null,
  initialScreens: UploadedScreen[] = []
): { screens: UploadedScreen[]; assetLoadState: UrlAssetLoadState } {
  const [screens, setScreens] = useState<UploadedScreen[]>(initialScreens);
  const [assetLoadState, setAssetLoadState] = useState<UrlAssetLoadState>(
    initialScreens.length > 0 ? "ready" : "idle"
  );

  useEffect(() => {
    if (initialScreens.length > 0) {
      setScreens(initialScreens);
      setAssetLoadState("ready");
      return;
    }

    if (!reviewId || !report || report.sourceType !== "url") {
      setScreens([]);
      setAssetLoadState("idle");
      return;
    }

    if (!report.screenAssets?.length) {
      setScreens([]);
      setAssetLoadState("missing");
      return;
    }

    let cancelled = false;
    setAssetLoadState("loading");

    void loadUrlReviewScreensFromStorage({ reviewId, report }).then((loaded) => {
      if (cancelled) return;

      setScreens(loaded);
      setAssetLoadState(loaded.length > 0 ? "ready" : "missing");
    });

    return () => {
      cancelled = true;
    };
  }, [reviewId, report, initialScreens]);

  useEffect(() => {
    return () => {
      revokeUploadedScreenUrls(screens);
    };
  }, [screens]);

  return { screens, assetLoadState };
}
