import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let groqLimiter: Ratelimit | null = null;
let postLimiter: Ratelimit | null = null;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Groq-calling routes (extract, projects): 10 requests/hour per user.
export function getGroqLimiter(): Ratelimit | null {
  if (groqLimiter) return groqLimiter;
  const redis = getRedis();
  if (!redis) return null;
  groqLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    prefix: 'ratelimit:groq',
  });
  return groqLimiter;
}

// POST /api/postings: 30 requests/hour per user.
export function getPostLimiter(): Ratelimit | null {
  if (postLimiter) return postLimiter;
  const redis = getRedis();
  if (!redis) return null;
  postLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 h'),
    prefix: 'ratelimit:postings',
  });
  return postLimiter;
}

export async function checkRateLimit(limiter: Ratelimit | null, key: string) {
  if (!limiter) return { success: true } as const;
  return limiter.limit(key);
}
