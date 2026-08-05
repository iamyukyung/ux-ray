/** Playwright 캡처 공통 설정 — /api/capture 와 URL 리뷰 캡처가 동일한 viewport·타임아웃을 사용합니다. */

export const CAPTURE_NAVIGATION_TIMEOUT_MS = 30_000;
export const CAPTURE_LOAD_STATE_TIMEOUT_MS = 10_000;
export const CAPTURE_STABILIZE_WAIT_MS = 1_500;
export const CAPTURE_FONT_WAIT_MS = 5_000;

export const CAPTURE_DESKTOP_VIEWPORT = { width: 1440, height: 900 };
export const CAPTURE_LOCALE = "ko-KR";
export const CAPTURE_TIMEZONE = "Asia/Seoul";
