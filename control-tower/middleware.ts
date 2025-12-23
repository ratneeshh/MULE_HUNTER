import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role; 

  const isLoginPage = nextUrl.pathname === "/login";
  const isAdminPage = nextUrl.pathname.startsWith("/admin");

  if (isLoginPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  if (isAdminPage) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};