import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    serverTimeIso: new Date().toISOString(),
    build: {
      version:
        process.env.NEXT_PUBLIC_APP_VERSION ??
        process.env.VERCEL_GIT_COMMIT_SHA ??
        "unknown",
      nodeEnv: process.env.NODE_ENV ?? "unknown",
      deploymentUrl: process.env.VERCEL_URL ?? "unknown",
    },
  });
}
