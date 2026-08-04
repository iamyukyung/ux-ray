export type ReviewInputType = "url" | "screenshots";

export type DeviceType = "desktop" | "mobile" | "tablet" | "custom";

/** @deprecated DeviceType 사용 */
export type ScreenDeviceType = DeviceType;

export type ScreenshotReviewMode = "single-screen" | "user-flow";

export interface UploadedScreen {
  id: string;
  file: File;
  fileName: string;
  previewUrl: string;
  width: number;
  height: number;
  fileSize: number;
  order: number;
  screenName: string;
  deviceType: DeviceType;
}

export interface ScreenshotReviewContext {
  projectName?: string;
  userGoal?: string;
  targetUser?: string;
  focusArea?: string;
  reviewMode: ScreenshotReviewMode;
  screens: UploadedScreen[];
}

export interface ScreenshotReviewInput {
  inputType: "screenshots";
  screenshotContext: ScreenshotReviewContext;
}

export type ScreenshotIssueSeverity = "high" | "medium" | "low";

export type ScreenshotIssueCategory =
  | "visual-hierarchy"
  | "navigation"
  | "interaction"
  | "consistency"
  | "feedback"
  | "error-prevention"
  | "accessibility"
  | "content"
  | "flow";

export interface ScreenReference {
  screenId: string;
  screenName: string;
  order: number;
}

export interface ScreenCropMetadata {
  cropId: string;
  screenId: string;
  index: number;
  yStart: number;
  yEnd: number;
  locationLabel: string;
  width: number;
  height: number;
}

export type AnalysisConfidence = "high" | "medium" | "low";

export interface ReviewAssumption {
  statement: string;
  confidence: AnalysisConfidence;
  basis: string;
}

export interface ScreenshotPageSummary {
  probablePurpose: string;
  contentNarrative: string;
  primaryAudiences: string[];
  assumptions: ReviewAssumption[];
}

export interface ScreenshotReviewQuality {
  specificity: number;
  evidenceQuality: number;
  actionability: number;
  prioritization: number;
  nonHallucination: number;
  wasRewritten: boolean;
}

export interface ScreenshotVisualEvidence {
  screenId: string;
  screenName: string;
  cropId?: string;
  locationLabel?: string;
  observation: string;
  confidence: AnalysisConfidence;
}

export interface ScreenshotReviewStrength {
  id?: string;
  title: string;
  description: string;
  evidence?: ScreenshotVisualEvidence[];
  screenReferences: ScreenReference[];
}

export interface ScreenshotReviewIssue {
  id: string;
  severity: ScreenshotIssueSeverity;
  category: ScreenshotIssueCategory;
  title: string;
  description: string;
  evidence: ScreenshotVisualEvidence[] | string[];
  screenReferences: ScreenReference[];
  expectedImpact: string;
  recommendation: string;
  validationMethod?: string;
}

export interface ScreenshotReviewInsight {
  summary: string;
  confidence: "high" | "medium" | "low";
  evidence: string[];
}

export interface ScreenshotReviewReport {
  inputType: "screenshots";
  analysisType?: "ai" | "mock";
  pipelineVersion?: string;
  reviewMode: ScreenshotReviewMode;
  createdAt: string;
  projectName?: string;
  userGoal?: string;
  targetUser?: string;
  focusArea?: string;
  screenCount: number;
  deviceSummary: string;
  pageSummary?: ScreenshotPageSummary;
  executiveSummary?: string;
  insight: ScreenshotReviewInsight;
  strengths?: ScreenshotReviewStrength[];
  issues: ScreenshotReviewIssue[];
  limitations?: string[];
  quality?: ScreenshotReviewQuality;
  cropMetadata?: ScreenCropMetadata[];
}

/** 개발 환경 디버그용 — API 응답에만 포함 (production 제외) */
export interface ScreenshotReviewDebugInfo {
  requestId: string;
  source: "ai";
  aiIssueCount: number;
  renderedIssueCount: number;
  analysisType: "ai";
  pipelineVersion?: string;
  diagnostics?: {
    requestId: string;
    pipelineVersion: string;
    screenCount: number;
    cropCount: number;
    imageFingerprints: string[];
    observerModel: string;
    reviewerModel: string;
    criticModel: string;
    observerMs: number;
    reviewerMs: number;
    criticMs: number;
    wasRewritten: boolean;
    finalIssueCount: number;
    qualityScores: ScreenshotReviewQuality;
  };
}

export const ANALYSIS_CONFIDENCE_LABELS: Record<AnalysisConfidence, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

export const SCREENSHOT_ISSUE_CATEGORY_META: Record<
  ScreenshotIssueCategory,
  { label: string; shortLabel: string }
> = {
  "visual-hierarchy": { label: "시각적 위계", shortLabel: "위계" },
  navigation: { label: "내비게이션", shortLabel: "내비" },
  interaction: { label: "상호작용", shortLabel: "상호작용" },
  consistency: { label: "일관성", shortLabel: "일관성" },
  feedback: { label: "피드백", shortLabel: "피드백" },
  "error-prevention": { label: "오류 예방", shortLabel: "오류 예방" },
  accessibility: { label: "접근성", shortLabel: "접근성" },
  content: { label: "콘텐츠", shortLabel: "콘텐츠" },
  flow: { label: "사용자 흐름", shortLabel: "흐름" },
};

export const SCREENSHOT_ISSUE_SEVERITY_META: Record<
  ScreenshotIssueSeverity,
  { label: string; fieldLabel: string }
> = {
  high: { label: "높음", fieldLabel: "영향도" },
  medium: { label: "보통", fieldLabel: "영향도" },
  low: { label: "낮음", fieldLabel: "영향도" },
};

export const SCREEN_DEVICE_LABELS: Record<DeviceType, string> = {
  desktop: "데스크톱",
  mobile: "모바일",
  tablet: "태블릿",
  custom: "직접 지정",
};

export const SCREEN_DEVICE_OPTIONS: { value: DeviceType; label: string }[] = [
  { value: "desktop", label: "데스크톱" },
  { value: "mobile", label: "모바일" },
  { value: "tablet", label: "태블릿" },
  { value: "custom", label: "직접 지정" },
];

export type Severity = "critical" | "high" | "medium" | "low";

export type Device = "desktop" | "mobile";

/** 이슈가 어느 환경에서 발견됐는지 — 두 환경 모두에서 재현되면 "both" */
export type IssueDevice = Device | "both";

export type Category =
  | "purpose"
  | "structure"
  | "cta"
  | "readability"
  | "trust"
  | "accessibility"
  | "mobileUsability";

export interface CategoryMeta {
  id: Category;
  label: string;
  shortLabel: string;
  description: string;
  /** 모바일 사용성처럼 세부 점검 항목이 있는 카테고리에서만 사용 */
  aspects?: string[];
}

/** 공통 6개 영역 + 모바일 전용 "모바일 사용성" 영역의 고정 메타데이터 */
export const CATEGORY_META: Record<Category, CategoryMeta> = {
  purpose: {
    id: "purpose",
    label: "목적 명확성",
    shortLabel: "목적",
    description: "방문자가 5초 안에 '이 페이지가 왜 존재하는지' 이해할 수 있는가",
  },
  structure: {
    id: "structure",
    label: "정보 구조",
    shortLabel: "구조",
    description: "콘텐츠의 위계와 흐름이 사용자의 사고 순서와 일치하는가",
  },
  cta: {
    id: "cta",
    label: "행동 유도",
    shortLabel: "행동 유도",
    description: "다음 행동이 무엇인지, 어디를 눌러야 하는지 명확한가",
  },
  readability: {
    id: "readability",
    label: "가독성",
    shortLabel: "가독성",
    description: "타이포그래피, 대비, 문장 길이가 읽기 부담을 낮추는가",
  },
  trust: {
    id: "trust",
    label: "신뢰도",
    shortLabel: "신뢰도",
    description: "신원, 근거, 사회적 증거가 방문자의 의심을 해소하는가",
  },
  accessibility: {
    id: "accessibility",
    label: "접근성",
    shortLabel: "접근성",
    description: "키보드, 스크린리더, 색약 사용자도 동일하게 이용할 수 있는가",
  },
  mobileUsability: {
    id: "mobileUsability",
    label: "모바일 사용성",
    shortLabel: "모바일 사용성",
    description: "작은 화면과 터치 입력 환경에 맞춰 레이아웃과 상호작용이 최적화되어 있는가",
    aspects: [
      "반응형 레이아웃",
      "내비게이션",
      "터치 상호작용",
      "CTA 노출성",
      "폼 사용성",
      "콘텐츠 밀도",
      "침습적 오버레이",
    ],
  },
};

/** 데스크톱·모바일 공통 6개 영역 (종합 점수 및 데스크톱 탭에서 사용) */
export const CORE_CATEGORY_ORDER: Category[] = [
  "purpose",
  "structure",
  "cta",
  "readability",
  "trust",
  "accessibility",
];

/** 모바일 탭에서 사용하는 7개 영역 (공통 6개 + 모바일 사용성) */
export const MOBILE_CATEGORY_ORDER: Category[] = [...CORE_CATEGORY_ORDER, "mobileUsability"];

export interface SeverityMeta {
  id: Severity;
  label: string;
  weight: number;
}

export const SEVERITY_META: Record<Severity, SeverityMeta> = {
  critical: { id: "critical", label: "심각", weight: 4 },
  high: { id: "high", label: "높음", weight: 3 },
  medium: { id: "medium", label: "보통", weight: 2 },
  low: { id: "low", label: "낮음", weight: 1 },
};

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

export interface DeviceMeta {
  id: Device;
  label: string;
  viewport: string;
}

export const DEVICE_META: Record<Device, DeviceMeta> = {
  desktop: { id: "desktop", label: "데스크톱", viewport: "1440×900" },
  mobile: { id: "mobile", label: "모바일", viewport: "390×844" },
};

export interface InsightEvidenceItem {
  label: string;
  description: string;
}

/** AI Product Designer 관점의 종합 인사이트 */
export interface AiInsight {
  /** 3~4문장 요약. 줄바꿈(\n)으로 문단을 구분할 수 있습니다. */
  summary: string;
  /** 70~98 사이의 Mock 신뢰도 (100% 미사용) */
  confidence: number;
  evidence: InsightEvidenceItem[];
}

export interface FixExperiment {
  hypothesis: string;
  metrics: string[];
  variants: string[];
}

/** Generate Fix에서 제안하는 수정안 */
export interface GeneratedFix {
  goal: string;
  layoutSuggestions: string[];
  copySuggestion?: string;
  figmaPrompt: string;
  cursorPrompt: string;
  experiment: FixExperiment;
}

export interface ReviewIssue {
  id: string;
  title: string;
  device: IssueDevice;
  location: string;
  severity: Severity;
  category: Category;
  evidence: string;
  userImpact: string;
  recommendation: string;
  copySuggestion?: string;
  /** AI 진단의 확신도 (0–100) */
  confidence: number;
  /** Generate Fix Mock 데이터 (없으면 Issue 필드로 기본값 생성) */
  generatedFix?: GeneratedFix;
}

export interface CategoryScore {
  category: Category;
  score: number;
  note: string;
}

/** 환경(데스크톱/모바일)별 분석 결과 */
export interface DeviceReport {
  device: Device;
  viewport: string;
  score: number;
  summary: string;
  categoryScores: CategoryScore[];
  /** 화면 미리보기용 목업 스크린샷 메타데이터 (실제 캡처 이미지는 아직 없음) */
  screenshotLabel: string;
}

export type ReviewStatus = "ready" | "not-found" | "failed";

export interface ReviewReport {
  id: string;
  status: "ready";
  /** 기본값 url — URL 캡처와 이미지 업로드 리뷰를 구분합니다. */
  inputType?: ReviewInputType;
  url: string;
  analyzedAt: string;
  overallScore: number;
  /** AI Product Designer 관점의 종합 인사이트 (없으면 overallSummary로 대체) */
  aiInsight?: AiInsight;
  /** 종합 탭 상단에 노출되는 한 문단 요약 */
  overallSummary: string;
  /** 두 환경의 점수·경험 차이를 설명하는 한 문단 요약 */
  differenceSummary: string;
  desktop: DeviceReport;
  mobile: DeviceReport;
  /** 모든 이슈(디바이스 태그 포함) — 종합 탭은 전체를, 각 디바이스 탭은 필터링해서 사용 */
  issues: ReviewIssue[];
  limitations: string[];
}

export function issuesForDevice(issues: ReviewIssue[], device: Device): ReviewIssue[] {
  return issues.filter((issue) => issue.device === device || issue.device === "both");
}
