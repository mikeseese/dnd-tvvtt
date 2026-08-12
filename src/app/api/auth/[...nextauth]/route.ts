import config from "@incanta/config";
import { NextResponse, type NextRequest } from "next/server";
import { handlers } from "~/server/auth";

const stubEnabled = config.get<boolean>("auth.stub.enabled");

/**
 * When stub auth is enabled, intercept sign-in / sign-out routes so the
 * browser gets real redirects instead of the NextAuth UI pages.
 */
function withStubRedirects(
  handler: (req: NextRequest) => Response | Promise<Response>,
) {
  return (req: NextRequest) => {
    if (stubEnabled) {
      const url = new URL(req.url);
      if (url.pathname.endsWith("/signin")) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
      if (url.pathname.endsWith("/signout")) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }
    return handler(req);
  };
}

export const GET = withStubRedirects(handlers.GET as (req: NextRequest) => Response | Promise<Response>);
export const POST = withStubRedirects(handlers.POST as (req: NextRequest) => Response | Promise<Response>);
