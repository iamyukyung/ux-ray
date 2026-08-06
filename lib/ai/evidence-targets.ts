import type { CropMetadata } from "@/lib/ai/image-preprocess";
import type { ProcessedScreenImage } from "@/lib/ai/image-preprocess";

export interface AllowedEvidenceTarget {
  screenId: string;
  cropId: string;
  type: "overview" | "crop";
  locationLabel: string;
}

export interface ScreenEvidenceTargets {
  screenId: string;
  targets: AllowedEvidenceTarget[];
}

const OVERVIEW_LOCATION_LABEL = "전체 화면";

export function overviewCropId(screenId: string): string {
  return `${screenId}-overview`;
}

/** 이미지 전처리 결과에서 화면별 허용 Evidence target 목록을 생성합니다. */
export function buildAllowedEvidenceTargets(
  processedScreens: ProcessedScreenImage[],
  cropMetadata: CropMetadata[]
): ScreenEvidenceTargets[] {
  const cropsByScreen = new Map<string, CropMetadata[]>();

  for (const crop of cropMetadata) {
    const list = cropsByScreen.get(crop.screenId) ?? [];
    list.push(crop);
    cropsByScreen.set(crop.screenId, list);
  }

  return processedScreens.map((screen) => {
    const sectionCrops = cropsByScreen.get(screen.screenId) ?? [];
    const targets: AllowedEvidenceTarget[] = [
      {
        screenId: screen.screenId,
        cropId: overviewCropId(screen.screenId),
        type: "overview",
        locationLabel: OVERVIEW_LOCATION_LABEL,
      },
    ];

    for (const crop of sectionCrops) {
      targets.push({
        screenId: screen.screenId,
        cropId: crop.cropId,
        type: "crop",
        locationLabel: crop.locationLabel,
      });
    }

    return { screenId: screen.screenId, targets };
  });
}

/** 레거시 호출(cropMetadata + screenId 집합)에서 target 목록을 구성합니다. */
export function buildAllowedEvidenceTargetsFromMetadata(
  cropMetadata: CropMetadata[],
  validScreenIds: Iterable<string>
): ScreenEvidenceTargets[] {
  const cropsByScreen = new Map<string, CropMetadata[]>();

  for (const crop of cropMetadata) {
    const list = cropsByScreen.get(crop.screenId) ?? [];
    list.push(crop);
    cropsByScreen.set(crop.screenId, list);
  }

  return [...validScreenIds].map((screenId) => {
    const sectionCrops = cropsByScreen.get(screenId) ?? [];
    const targets: AllowedEvidenceTarget[] = [
      {
        screenId,
        cropId: overviewCropId(screenId),
        type: "overview",
        locationLabel: OVERVIEW_LOCATION_LABEL,
      },
    ];

    for (const crop of sectionCrops) {
      targets.push({
        screenId,
        cropId: crop.cropId,
        type: "crop",
        locationLabel: crop.locationLabel,
      });
    }

    return { screenId, targets };
  });
}

export function flattenAllowedEvidenceTargets(
  screens: ScreenEvidenceTargets[]
): AllowedEvidenceTarget[] {
  return screens.flatMap((screen) => screen.targets);
}

export function buildAllowedTargetLookup(
  screens: ScreenEvidenceTargets[]
): Map<string, AllowedEvidenceTarget> {
  const lookup = new Map<string, AllowedEvidenceTarget>();

  for (const screen of screens) {
    for (const target of screen.targets) {
      lookup.set(`${target.screenId}:${target.cropId}`, target);
    }
  }

  return lookup;
}

export function getScreenSectionCropCount(
  screenId: string,
  screens: ScreenEvidenceTargets[]
): number {
  const screen = screens.find((item) => item.screenId === screenId);
  if (!screen) return 0;
  return screen.targets.filter((target) => target.type === "crop").length;
}

export function getOverviewTarget(
  screenId: string,
  screens: ScreenEvidenceTargets[]
): AllowedEvidenceTarget | undefined {
  return screens
    .find((item) => item.screenId === screenId)
    ?.targets.find((target) => target.type === "overview");
}

/** Reviewer / Critic / Rewrite 프롬프트용 JSON */
export function formatAllowedTargetsForPrompt(screens: ScreenEvidenceTargets[]): string {
  const payload = screens.map((screen) => ({
    screenId: screen.screenId,
    targets: screen.targets.map((target) => ({
      screenId: target.screenId,
      cropId: target.cropId,
      type: target.type,
      locationLabel: target.locationLabel,
    })),
  }));

  return JSON.stringify(payload, null, 2);
}

export function countAllowedTargets(screens: ScreenEvidenceTargets[]): number {
  return flattenAllowedEvidenceTargets(screens).length;
}
