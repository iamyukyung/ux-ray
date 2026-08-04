/** full-page screenshot을 시도할 수 있는 최대 문서 높이 (CSS px) */
export const MAX_FULL_PAGE_HEIGHT = 12_000;

/** partial 캡처 시 수집하는 최대 높이 (CSS px) — MAX_FULL_PAGE_HEIGHT와 동일 */
export const MAX_CAPTURE_HEIGHT = MAX_FULL_PAGE_HEIGHT;

/** lazy-load 스크롤: 최대 반복 횟수 */
export const MAX_SCROLL_ITERATIONS = 40;

/** lazy-load 스크롤: 최대 소요 시간 (ms) */
export const MAX_SCROLL_DURATION_MS = 15_000;

/** 동일 documentHeight가 연속 유지되면 종료 */
export const STABLE_HEIGHT_THRESHOLD = 3;

export const PARTIAL_CAPTURE_WARNING = `페이지가 길어 상단 ${MAX_FULL_PAGE_HEIGHT}px까지 캡처했습니다.`;

export const PARTIAL_CAPTURE_BADGE = "페이지가 길어 주요 구간만 캡처했어요.";
