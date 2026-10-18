import { cookies } from "next/headers";
import crypto from "crypto";

const ADMIN_COOKIE_NAME = "omd_admin_auth";
const DEFAULT_PASSWORD = "admin2026";

function getAdminSecret(): string {
  const secret = process.env.ADMIN_SECRET || process.env.STRIPE_SECRET_KEY || "omd-luxury-secret-fallback";
  return secret.trim();
}

function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD?.trim();
  return password || DEFAULT_PASSWORD;
}

export function generateAuthToken(): string {
  const secret = getAdminSecret();
  const password = getAdminPassword();
  return crypto.createHmac("sha256", secret).update(`omd-admin-auth-${password}`).digest("hex");
}

export async function verifyAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;

  const expectedToken = generateAuthToken();
  const tokenBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expectedToken);

  if (tokenBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
}

export function validatePassword(inputPassword: string): boolean {
  const adminPassword = getAdminPassword();
  const inputBuffer = Buffer.from(inputPassword.trim());
  const expectedBuffer = Buffer.from(adminPassword);

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}

export const AUTH_COOKIE = {
  name: ADMIN_COOKIE_NAME,
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};
