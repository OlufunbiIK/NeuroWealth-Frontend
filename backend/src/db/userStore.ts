/**
 *
 * In-memory user store for development.
 * To migrate to Postgres/Supabase: keep these function signatures identical,
 * just replace the Map with real SQL queries inside each function.
 */
import { randomUUID } from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OnboardingStep =
  // new user, sent welcome, waiting for strategy pick
  | "awaiting_strategy"
  // showed strategy details, waiting for YES
  | "awaiting_confirmation"
  // wallet created, waiting for USDC to arrive
  | "awaiting_deposit"
  // fully onboarded
  | "active";

export type Strategy = "conservative" | "balanced" | "growth";

export interface User {
  id: string;
  phone: string;
  step: OnboardingStep;
  strategy: Strategy | null;
  walletAddress: string | null;
  encryptedPrivateKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const store = new Map<string, User>();

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function findUserByPhone(phone: string): Promise<User | null> {
  return store.get(phone) ?? null;
}

export async function createUser(phone: string): Promise<User> {
  const user: User = {
    id: randomUUID(),
    phone,
    step: "awaiting_strategy",
    strategy: null,
    walletAddress: null,
    encryptedPrivateKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.set(phone, user);
  return user;
}

export async function setUserStrategy(
  phone: string,
  strategy: Strategy,
): Promise<void> {
  const user = store.get(phone);
  if (!user) throw new Error(`User not found: ${phone}`);
  store.set(phone, {
    ...user,
    strategy,
    step: "awaiting_confirmation",
    updatedAt: new Date(),
  });
}

export async function setUserWallet(
  phone: string,
  walletAddress: string,
  encryptedPrivateKey: string,
): Promise<void> {
  const user = store.get(phone);
  if (!user) throw new Error(`User not found: ${phone}`);
  store.set(phone, {
    ...user,
    walletAddress,
    encryptedPrivateKey,
    step: "awaiting_deposit",
    updatedAt: new Date(),
  });
}

export async function setUserStep(
  phone: string,
  step: OnboardingStep,
): Promise<void> {
  const user = store.get(phone);
  if (!user) throw new Error(`User not found: ${phone}`);
  store.set(phone, { ...user, step, updatedAt: new Date() });
}

// ─── Test helpers (never call in production code) ─────────────────────────────
export const _test = {
  clear: () => store.clear(),
  all: () => Array.from(store.values()),
};
