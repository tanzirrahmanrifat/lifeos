import { hash, verify } from "@node-rs/argon2";

// Argon2id (the library default) with the OWASP-recommended minimum cost profile.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false; // malformed hash etc. — treat as a failed login, never as a crash
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Burns roughly the same time as a real verification. Call it when the email is unknown so response
 * timing doesn't reveal which addresses have accounts.
 */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword("lifeos-timing-equalisation");
  await verifyPassword(await dummyHash, password);
}
