import { CaptureError } from "./capture-errors";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
  "metadata.azure.com",
  "instance-data",
]);

const METADATA_HOST_PATTERNS = [
  /^metadata\./i,
  /\.metadata\./i,
  /^instance-data$/i,
];

function isPrivateIpv4(octets: number[]): boolean {
  const a = octets[0] ?? 0;
  const b = octets[1] ?? 0;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return null;
  }
  return octets;
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80:")) return true;
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, "");

  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  if (lower.endsWith(".localhost")) return true;
  if (METADATA_HOST_PATTERNS.some((pattern) => pattern.test(lower))) return true;

  const ipv4 = parseIpv4(lower);
  if (ipv4 && isPrivateIpv4(ipv4)) return true;

  if (lower.includes(":") && isPrivateIpv6(lower)) return true;

  return false;
}

/** http/https 공개 URL만 허용하고, SSRF 위험 주소를 차단합니다. */
export function assertSafeCaptureUrl(rawUrl: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new CaptureError("INVALID_URL", "올바른 URL을 입력해주세요.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new CaptureError("BLOCKED_URL", "http 또는 https URL만 분석할 수 있어요.");
  }

  if (parsed.username || parsed.password) {
    throw new CaptureError("BLOCKED_URL", "인증 정보가 포함된 URL은 분석할 수 없어요.");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");

  if (isBlockedHostname(hostname)) {
    throw new CaptureError("BLOCKED_URL", "내부 네트워크 또는 차단된 주소는 분석할 수 없어요.");
  }

  return parsed;
}

export function normalizeCaptureUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return assertSafeCaptureUrl(withProtocol).toString();
}
