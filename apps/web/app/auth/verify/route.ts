// Sign-in links were replaced by 6-digit codes. Any old link opens the sign-in screen.
export const dynamic = "force-dynamic";

const toSignIn = (req: Request) => Response.redirect(new URL("/signin", req.url), 303);
export const GET = toSignIn;
export const POST = toSignIn;
