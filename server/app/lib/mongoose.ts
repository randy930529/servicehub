import mongoose from "mongoose";

/**
 * Cached Mongoose connection.
 *
 * Next.js hot-reloads modules in development, which would otherwise open a new
 * MongoDB connection on every change and exhaust the pool. We cache the
 * connection (and its in-flight promise) on `globalThis` so it survives reloads
 * and concurrent requests share a single connection.
 */
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = globalThis._mongooseCache ?? {
  conn: null,
  promise: null,
};
globalThis._mongooseCache = cache;

/** Opens (or reuses) the shared MongoDB connection. */
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI. Add it to server/.env.local (see .env.example).",
    );
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      // Fail fast on an unreachable DB instead of queueing queries...
      bufferCommands: false,
      // ...or hanging on the default 30s server-selection timeout.
      serverSelectionTimeoutMS: 5000,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    // Reset so the next call retries instead of reusing a rejected promise.
    cache.promise = null;
    throw error;
  }

  return cache.conn;
}
