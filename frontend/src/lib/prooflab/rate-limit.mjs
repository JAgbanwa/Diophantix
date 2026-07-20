import { createHash } from "node:crypto";

import { ProofLabError } from "./verifier.mjs";

const WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_LIMIT = 12;
const DEFAULT_DAILY_LIMIT = 750;
const localBuckets = new Map();

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getClientAddress(request) {
  return (
    request.headers.get("x-vercel-proxied-for")?.split(",")[0]?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown"
  );
}

function anonymizeAddress(address) {
  const salt = process.env.PROOFLAB_RATE_LIMIT_SALT?.trim() || "diophantix-prooflab";
  return createHash("sha256").update(`${salt}:${address}`).digest("hex").slice(0, 24);
}

function secondsUntilUtcMidnight() {
  const now = new Date();
  const tomorrow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(60, Math.ceil((tomorrow - now.getTime()) / 1000));
}

async function runRedisPipeline(commands) {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;

  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Managed limiter returned ${response.status}.`);
  const results = await response.json();
  if (!Array.isArray(results) || results.some((item) => item?.error)) {
    throw new Error("Managed limiter returned an invalid response.");
  }
  return results.map((item) => Number(item.result));
}

async function enforceManagedLimit(addressHash) {
  const requestLimit = positiveInteger(process.env.PROOFLAB_REQUEST_LIMIT, DEFAULT_LIMIT);
  const dailyLimit = positiveInteger(process.env.PROOFLAB_DAILY_REQUEST_LIMIT, DEFAULT_DAILY_LIMIT);
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const windowKey = `prooflab:window:${addressHash}:${Math.floor(now.getTime() / WINDOW_MS)}`;
  const dayKey = `prooflab:daily:${day}`;
  const results = await runRedisPipeline([
    ["INCR", windowKey],
    ["PEXPIRE", windowKey, WINDOW_MS + 5_000, "NX"],
    ["INCR", dayKey],
    ["EXPIRE", dayKey, secondsUntilUtcMidnight() + 60, "NX"],
  ]);
  if (!results) return null;
  const [windowCount, , dailyCount] = results;
  if (windowCount > requestLimit) {
    throw new ProofLabError("ProofLab request limit reached. Retry after the current five-minute window.", "RATE_LIMITED");
  }
  if (dailyCount > dailyLimit) {
    throw new ProofLabError("ProofLab has reached today's public AI budget. The offline demonstrations remain available.", "DAILY_BUDGET_REACHED");
  }
  return { backend: "managed", remaining: Math.max(0, requestLimit - windowCount) };
}

function enforceLocalLimit(addressHash) {
  const now = Date.now();
  const requestLimit = positiveInteger(process.env.PROOFLAB_REQUEST_LIMIT, DEFAULT_LIMIT);
  const existing = localBuckets.get(addressHash);
  if (!existing || now - existing.startedAt >= WINDOW_MS) {
    localBuckets.set(addressHash, { startedAt: now, count: 1 });
    return { backend: "local", remaining: requestLimit - 1 };
  }
  existing.count += 1;
  if (existing.count > requestLimit) {
    throw new ProofLabError("ProofLab request limit reached. Retry after the current five-minute window.", "RATE_LIMITED");
  }
  if (localBuckets.size > 2_000) {
    for (const [key, bucket] of localBuckets) {
      if (now - bucket.startedAt >= WINDOW_MS) localBuckets.delete(key);
    }
  }
  return { backend: "local", remaining: Math.max(0, requestLimit - existing.count) };
}

export function managedLimiterConfigured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim()
    && process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

export async function enforceRateLimit(request) {
  const addressHash = anonymizeAddress(getClientAddress(request));
  if (managedLimiterConfigured()) {
    try {
      return await enforceManagedLimit(addressHash);
    } catch (error) {
      if (error instanceof ProofLabError) throw error;
      throw new ProofLabError("The managed request limiter is temporarily unavailable. Retry shortly.", "RATE_LIMIT_UNAVAILABLE");
    }
  }
  return enforceLocalLimit(addressHash);
}
