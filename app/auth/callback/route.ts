import { NextResponse, type NextRequest } from "next/server";

import { sanitizeInternalRedirect } from "@/lib/auth/login-schema";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = sanitizeInternalRedirect(
    request.nextUrl.searchParams.get("next") ?? "/reset-password",
  );
  if (!code)
    return NextResponse.redirect(new URL("/forgot-password", request.url));
  const supabase = await createClient();
  const result = await supabase.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(
    new URL(result.error ? "/forgot-password" : nextPath, request.url),
  );
}
