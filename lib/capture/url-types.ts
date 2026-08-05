export type UrlCaptureDeviceType = "desktop" | "mobile";

export interface UrlDomSnapshot {
  lang: string | null;
  title: string | null;
  metaDescription: string | null;
  landmarks: Array<{
    id: string;
    role: string;
    label: string | null;
    top: number;
  }>;
  headings: Array<{
    id: string;
    level: 1 | 2 | 3;
    text: string;
    top: number;
  }>;
  interactiveElements: Array<{
    id: string;
    role: string;
    accessibleName: string | null;
    visibleText: string | null;
    type: string | null;
    disabled: boolean;
    top: number;
  }>;
  forms: Array<{
    id: string;
    top: number;
    fields: Array<{
      role: string;
      label: string | null;
      placeholder: string | null;
      required: boolean;
      disabled: boolean;
    }>;
  }>;
  navigationLinks: Array<{
    text: string;
    hrefPath: string | null;
    top: number;
  }>;
}

export interface CapturedUrlPage {
  requestedUrl: string;
  finalUrl: string;
  pageTitle: string | null;
  viewport: {
    width: number;
    height: number;
    deviceScaleFactor: number;
  };
  fullPageImage: Buffer;
  mimeType: "image/png";
  width: number;
  height: number;
  domSnapshot: UrlDomSnapshot;
}

export type UrlReviewErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_PROTOCOL"
  | "PRIVATE_ADDRESS_BLOCKED"
  | "UNSAFE_REDIRECT"
  | "CAPTURE_TIMEOUT"
  | "ACCESS_BLOCKED"
  | "PAGE_UNAVAILABLE"
  | "EMPTY_PAGE"
  | "PIPELINE_TIMEOUT"
  | "AI_NOT_CONFIGURED"
  | "INVALID_AI_RESPONSE"
  | "INTERNAL_ERROR";

export interface UrlReviewRequest {
  url: string;
  deviceType: UrlCaptureDeviceType;
  reviewLens: "general" | "norman";
  projectName?: string;
  userGoal?: string;
  targetUser?: string;
  focusArea?: string;
  externalProcessingConsent: boolean;
}

export interface UrlReviewSource {
  requestedUrl: string;
  finalUrl: string;
  pageTitle: string | null;
  deviceType: UrlCaptureDeviceType;
}
