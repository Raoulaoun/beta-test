import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const newToken = (bytes = 32): string => randomBytes(bytes).toString("base64url");
export const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex"), y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}
