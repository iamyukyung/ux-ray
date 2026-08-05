import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { UrlReviewError } from "@/lib/capture/url-review-errors";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
  "metadata.azure.com",
  "instance-data",
]);

const METADATA_HOST_PATTERNS = [/^metadata\./i, /\.metadata\./i, /^instance-data$/i];

const ALLOWED_PORTS = new Set([80, 443]);

function parseIpv4(octets: number[]): number {
  return (
    ((octets[0] ?? 0) << 24) |
    ((octets[1] ?? 0) << 16) |
    ((octets[2] ?? 0) << 8) |
    (octets[3] ?? 0)
  ) >>> 0;
}

function parseIpv4String(hostname: string): number[] | null {
  if (isIP(hostname) !== 4) return null;
  const parts = hostname.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
  return octets;
}

function isBlockedIpv4(octets: number[]): boolean {
  const n = parseIpv4(octets);
  const a = octets[0] ?? 0;
  const b = octets[1] ?? 0;

  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0) return true;
  if (a === 192 && b === 2) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51) return true;
  if (a === 203 && b === 0) return true;
  if (a >= 224 && a <= 239) return true;
  if (a >= 240) return true;

  if (n === parseIpv4([169, 254, 169, 254])) return true;

  return false;
}

function normalizeIpv6(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "");
}

function isBlockedIpv6(hostname: string): boolean {
  const normalized = normalizeIpv6(hostname);
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
  if (normalized === "::") return true;

  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80:")) return true;

  const v4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4Mapped?.[1]) {
    const octets = parseIpv4String(v4Mapped[1]);
    if (octets && isBlockedIpv4(octets)) return true;
  }

  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, "");

  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  if (lower.endsWith(".localhost")) return true;
  if (lower.endsWith(".local")) return true;
  if (METADATA_HOST_PATTERNS.some((pattern) => pattern.test(lower))) return true;

  const ipv4 = parseIpv4String(lower);
  if (ipv4 && isBlockedIpv4(ipv4)) return true;

  if (lower.includes(":") && isBlockedIpv6(lower)) return true;

  return false;
}

async function assertResolvedAddressesSafe(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    if (isBlockedHostname(hostname)) {
      throw new UrlReviewError(
        "PRIVATE_ADDRESS_BLOCKED",
        "로컬 또는 내부망 주소는 분석할 수 없어요."
      );
    }
    return;
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UrlReviewError("PAGE_UNAVAILABLE", "페이지 주소를 확인할 수 없어요.");
  }

  if (records.length === 0) {
    throw new UrlReviewError("PAGE_UNAVAILABLE", "페이지 주소를 확인할 수 없어요.");
  }

  for (const record of records) {
    if (isBlockedHostname(record.address)) {
      throw new UrlReviewError(
        "PRIVATE_ADDRESS_BLOCKED",
        "로컬 또는 내부망 주소는 분석할 수 없어요."
      );
    }
  }
}

export function normalizePublicUrl(rawUrl: string): URL {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new UrlReviewError("INVALID_URL", "분석할 URL을 입력해주세요.");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new UrlReviewError("INVALID_URL", "올바른 URL을 입력해주세요.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UrlReviewError("UNSUPPORTED_PROTOCOL", "http 또는 https URL만 분석할 수 있어요.");
  }

  if (parsed.username || parsed.password) {
    throw new UrlReviewError("INVALID_URL", "인증 정보가 포함된 URL은 분석할 수 없어요.");
  }

  const port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;
  if (!ALLOWED_PORTS.has(port)) {
    throw new UrlReviewError("INVALID_URL", "지원하지 않는 URL 포트입니다.");
  }

  parsed.hash = "";

  return parsed;
}

export async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  const parsed = normalizePublicUrl(rawUrl);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");

  if (isBlockedHostname(hostname)) {
    throw new UrlReviewError(
      "PRIVATE_ADDRESS_BLOCKED",
      "로컬 또는 내부망 주소는 분석할 수 없어요."
    );
  }

  await assertResolvedAddressesSafe(hostname);
  return parsed;
}

export async function assertSafeRedirectUrl(rawUrl: string): Promise<URL> {
  try {
    return await assertSafePublicUrl(rawUrl);
  } catch (error) {
    if (error instanceof UrlReviewError && error.code === "PRIVATE_ADDRESS_BLOCKED") {
      throw new UrlReviewError("UNSAFE_REDIRECT", "리다이렉트된 주소는 분석할 수 없어요.");
    }
    throw error;
  }
}

export function hostnameForLog(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}
