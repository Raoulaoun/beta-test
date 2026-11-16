// Liveness for Railway. Does not call the scoring service.
export const dynamic = "force-dynamic";
export function GET(): Response {
  return Response.json({ ok: true });
}
