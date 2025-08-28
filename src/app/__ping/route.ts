export async function GET() {
  // Lightweight reachability endpoint
  return new Response("ok", { status: 204, headers: { "cache-control": "no-store" } });
}

export async function HEAD() {
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}

