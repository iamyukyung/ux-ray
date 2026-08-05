export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function scoreTone(score: number): "positive" | "medium" | "critical" {
  if (score >= 75) return "positive";
  if (score >= 50) return "medium";
  return "critical";
}

/** 아주 단순한 URL 형태 검증 — 실제 도달 가능성까지는 확인하지 않습니다. */
export function looksLikeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    return parsed.hostname.includes(".");
  } catch {
    return false;
  }
}

export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** 긴 query string을 리포트·UI에 그대로 노출하지 않습니다. */
export function formatUrlForDisplay(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.search.length > 80) {
      return `${parsed.origin}${parsed.pathname}?…`;
    }
    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return value.length > 120 ? `${value.slice(0, 117)}…` : value;
  }
}
