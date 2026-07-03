import { NextResponse, type NextRequest } from "next/server"

const SESSION_COOKIE = "mcc_session"

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = pathname === "/" || pathname.startsWith("/dashboard")
  if (!isProtected) return NextResponse.next()

  // Lightweight cookie-presence check; full session validation happens
  // server-side in the dashboard layout.
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value)
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
}
