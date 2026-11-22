import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { BREVO_URL, brevoBody, outbox, sendMail } from "../../lib/server/mailer.ts";

const mail = { to: "karim@example.com", subject: "Your Manager Test report", html: "<p>Hi</p>", text: "Hi", kind: "report",
  attachments: [{ filename: "Manager-Test-Report-Karim.pdf", content: Buffer.from("%PDF-1.7 test") }] };
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; delete process.env.BREVO_API_KEY; delete process.env.MAIL_FROM; delete process.env.MAIL_FROM_NAME; outbox.length = 0; });

test("Brevo body: sender, recipient, both bodies, PDF as base64 attachment", () => {
  const b = brevoBody(mail, "hello@betaapp.me", "The Manager Test by Beta");
  assert.deepEqual(b.sender, { name: "The Manager Test by Beta", email: "hello@betaapp.me" });
  assert.deepEqual(b.to, [{ email: "karim@example.com" }]);
  assert.equal(b.htmlContent, "<p>Hi</p>");
  assert.equal(b.textContent, "Hi");
  assert.deepEqual(b.attachment, [{ name: "Manager-Test-Report-Karim.pdf", content: Buffer.from("%PDF-1.7 test").toString("base64") }]);
  assert.equal("attachment" in brevoBody({ ...mail, attachments: [] }, "hello@betaapp.me"), false);
  assert.throws(() => brevoBody(mail, ""), /MAIL_FROM/);
});

test("with a key: one POST to Brevo with the api-key header; the message id comes back", async () => {
  process.env.BREVO_API_KEY = "test-key"; process.env.MAIL_FROM = "hello@betaapp.me";
  let seen: { url: string; init: RequestInit } | null = null;
  globalThis.fetch = (async (url: string, init: RequestInit) => { seen = { url, init }; return new Response(JSON.stringify({ messageId: "<abc@smtp-relay>" }), { status: 201 }); }) as typeof fetch;
  const out = await sendMail(mail);
  assert.equal(out.id, "<abc@smtp-relay>");
  assert.equal(seen!.url, BREVO_URL);
  assert.equal((seen!.init.headers as Record<string, string>)["api-key"], "test-key");
  assert.equal(JSON.parse(seen!.init.body as string).sender.name, "The Manager Test by Beta");
  assert.equal(outbox.length, 0);
});

test("a provider error is an error (the caller logs it as failed)", async () => {
  process.env.BREVO_API_KEY = "test-key"; process.env.MAIL_FROM = "hello@betaapp.me";
  globalThis.fetch = (async () => new Response("{}", { status: 401 })) as typeof fetch;
  await assert.rejects(sendMail(mail), /email provider error 401/);
});

test("without a key (local): the outbox", async () => {
  await sendMail(mail);
  assert.equal(outbox.length, 1);
});
