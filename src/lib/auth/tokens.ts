import { createHash, randomBytes } from "node:crypto";

/** 256-bit random token, URL/cookie safe. Only its hash is ever stored. */
export const generateToken = () => randomBytes(32).toString("base64url");

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
