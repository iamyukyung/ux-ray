import type { CaptureSegment } from "./capture-types";

export interface SegmentDisplayItem {
  scrollY: number;
  screenshot: string;
  label: string;
  overlapTopPx: number;
  gapBeforePx: number;
  anchorId: string;
}

export interface SegmentDisplayMetadata {
  items: SegmentDisplayItem[];
  gapWarnings: string[];
  /** 고정 헤더 등이 segment마다 반복될 수 있음 */
  duplicateRegionNotice: boolean;
}

const GAP_TOLERANCE_PX = 2;

/**
 * partial capture segments를 연속 스크롤 표시용으로 정렬·메타데이터 계산합니다.
 * 캡처 데이터는 변경하지 않고 표시용 layout 정보만 반환합니다.
 */
export function buildSegmentDisplayMetadata(
  segments: CaptureSegment[],
  viewportHeight: number
): SegmentDisplayMetadata {
  const sorted = [...segments].sort((a, b) => a.scrollY - b.scrollY);
  const gapWarnings: string[] = [];
  const items: SegmentDisplayItem[] = [];

  sorted.forEach((segment, index) => {
    let overlapTopPx = 0;
    let gapBeforePx = 0;

    if (index > 0) {
      const previous = sorted[index - 1]!;
      const expectedStart = previous.scrollY + viewportHeight;
      const delta = segment.scrollY - expectedStart;

      if (delta > GAP_TOLERANCE_PX) {
        gapBeforePx = delta;
        gapWarnings.push(
          `${index === 1 ? "구간 2" : `구간 ${index + 1}`} 앞에 약 ${Math.round(delta)}px 구간이 캡처되지 않았어요.`
        );
      } else if (delta < -GAP_TOLERANCE_PX) {
        overlapTopPx = Math.max(0, expectedStart - segment.scrollY);
      }
    }

    items.push({
      scrollY: segment.scrollY,
      screenshot: segment.screenshot,
      label: index === 0 ? "첫 화면" : `구간 ${index + 1}`,
      overlapTopPx,
      gapBeforePx,
      anchorId: `segment-${segment.scrollY}-${index}`,
    });
  });

  return {
    items,
    gapWarnings,
    duplicateRegionNotice: false,
  };
}

export function hasSegmentedCapture(
  screenshot: { captureStatus?: string; segments?: CaptureSegment[] }
): boolean {
  return screenshot.captureStatus === "partial" && (screenshot.segments?.length ?? 0) > 0;
}
