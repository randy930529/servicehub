import bcrypt from "bcryptjs";

/**
 * bcrypt cost factor. 10 keeps login latency reasonable for a learning
 * project; bump it if hardware allows (each +1 doubles hashing time).
 */
const SALT_ROUNDS = 10;

/** Hashes a plain-text password for storage (`User.passwordHash`). */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/** Constant-time comparison of a plain password against a stored hash. */
export function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
