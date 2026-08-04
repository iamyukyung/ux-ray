import type {
  DeviceType,
  ScreenshotReviewContext,
  ScreenshotReviewMode,
  UploadedScreen,
} from "./types";

export function defaultScreenName(order: number): string {
  return `화면 ${order + 1}`;
}

export function inferDefaultDeviceType(width: number, height: number): DeviceType {
  const isPortrait = height > width;
  const isLandscape = width > height;

  if (isPortrait && width <= 480) return "mobile";
  if (isLandscape && width >= 1024) return "desktop";
  return "custom";
}

export function normalizeScreenOrders(screens: UploadedScreen[]): UploadedScreen[] {
  return screens.map((screen, index) => ({
    ...screen,
    order: index,
  }));
}

export function getScreenshotReviewMode(screenCount: number): ScreenshotReviewMode | null {
  if (screenCount <= 0) return null;
  if (screenCount === 1) return "single-screen";
  return "user-flow";
}

export function getReviewModeLabel(
  mode: ScreenshotReviewMode,
  screenCount: number
): string {
  if (mode === "single-screen") return "단일 화면 리뷰";
  return `사용자 흐름 리뷰 · ${screenCount}개 화면`;
}

export function reorderScreens(
  screens: UploadedScreen[],
  fromIndex: number,
  toIndex: number
): UploadedScreen[] {
  if (fromIndex === toIndex) return screens;
  const next = [...screens];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return screens;
  next.splice(toIndex, 0, moved);
  return normalizeScreenOrders(next);
}

export function moveScreen(
  screens: UploadedScreen[],
  id: string,
  direction: "up" | "down"
): UploadedScreen[] {
  const index = screens.findIndex((screen) => screen.id === id);
  if (index === -1) return screens;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= screens.length) return screens;

  return reorderScreens(screens, index, targetIndex);
}

export function isScreenConfigured(screen: UploadedScreen): boolean {
  return screen.screenName.trim().length > 0 && Boolean(screen.deviceType);
}

export function buildScreenshotReviewContext(
  screens: UploadedScreen[],
  fields: Pick<
    ScreenshotReviewContext,
    "projectName" | "userGoal" | "targetUser" | "focusArea"
  >
): ScreenshotReviewContext | null {
  const reviewMode = getScreenshotReviewMode(screens.length);
  if (!reviewMode) return null;

  return {
    projectName: fields.projectName?.trim() || undefined,
    userGoal: fields.userGoal?.trim() || undefined,
    targetUser: fields.targetUser?.trim() || undefined,
    focusArea: fields.focusArea?.trim() || undefined,
    reviewMode,
    screens: normalizeScreenOrders(screens),
  };
}

export function countScreensByDevice(context: ScreenshotReviewContext): {
  desktop: number;
  mobile: number;
  tablet: number;
  custom: number;
} {
  const counts = { desktop: 0, mobile: 0, tablet: 0, custom: 0 };

  for (const screen of context.screens) {
    counts[screen.deviceType] += 1;
  }

  return counts;
}

export function sortScreensByOrder(screens: ScreenshotReviewContext["screens"]) {
  return [...screens].sort((a, b) => a.order - b.order);
}

export const SCREENSHOT_MOCK_STEP_DELAY_MS = 1_000;
