import { NextResponse, type NextRequest } from "next/server"
import {
  createContentSecurityPolicy,
  createCspNonce,
} from "@/security/content-security-policy"

function internalDemoRoutesEnabled() {
  return process.env.CLAWCHAT_ENABLE_INTERNAL_DEMO_ROUTES === "true"
}

function developmentRailwayRewriteNeedsOriginRemoval() {
  return process.env.NODE_ENV === "development"
}

function nextWithDocumentCsp(request: NextRequest) {
  const nonce = createCspNonce()
  const contentSecurityPolicy = createContentSecurityPolicy(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  response.headers.set("Content-Security-Policy", contentSecurityPolicy)
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === "/api/v1" || pathname.startsWith("/api/v1/")) {
    if (!developmentRailwayRewriteNeedsOriginRemoval()) {
      return NextResponse.next()
    }

    const requestHeaders = new Headers(request.headers)
    requestHeaders.delete("origin")

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  if (
    pathname.startsWith("/html-native-demo") ||
    pathname.startsWith("/landing-pages")
  ) {
    return internalDemoRoutesEnabled()
      ? nextWithDocumentCsp(request)
      : new NextResponse("Not found", { status: 404 })
  }

  return nextWithDocumentCsp(request)
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[^/]+$).*)",
    },
    "/api/v1/:path*",
    "/html-native-demo/:path*",
    "/landing-pages/:path*",
  ],
}
