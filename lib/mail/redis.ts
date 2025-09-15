import { createClient, type RedisClientType } from "redis";

const url = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redis: RedisClientType = createClient({ url });

redis.on("error", (e) => {
  console.error("Redis error:", e);
});

let connectPromise: Promise<void> | null = null;

export async function ensureRedis(): Promise<void> {
  if (redis.isOpen) return;

  if (!connectPromise) {
    connectPromise = (redis.connect() as unknown) as Promise<void>;
  }

  await connectPromise;
}
