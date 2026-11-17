// Local testing only: the in-memory outbox (used when no email provider is configured).
// Off unless DEV_OUTBOX=1, and never on the production site.
import { outbox } from "../../../../lib/server/mailer.ts";
import { isProductionSite } from "../../../../lib/site.ts";

export const dynamic = "force-dynamic";

export function GET(): Response {
  if (process.env.DEV_OUTBOX !== "1" || isProductionSite()) return new Response(null, { status: 404 });
  return Response.json(outbox.map(({ to, subject, text, kind }) => ({ to, subject, text, kind })));
}
