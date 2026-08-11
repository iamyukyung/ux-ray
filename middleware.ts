import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function decodeBasicCredentials(header: string): { user: string; password: string } | null {
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return null;

  try {
    const decoded = atob(encoded);
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      user: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const expectedUser = process.env.BASIC_AUTH_USER?.trim();
  const expectedPassword = process.env.BASIC_AUTH_PASSWORD?.trim();

  if (!expectedUser || !expectedPassword) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const credentials = decodeBasicCredentials(authHeader);
    if (
      credentials &&
      credentials.user === expectedUser &&
      credentials.password === expectedPassword
    ) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="UX-Ray", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
