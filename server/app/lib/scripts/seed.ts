/**
 * Seeds the local MongoDB with the catalog. Run with: `pnpm seed`.
 *
 * Standalone script (not run by Next), so it loads env from `.env.local`
 * itself. Node 20.12+/22+ exposes `process.loadEnvFile`.
 */
import process from "node:process";

import mongoose from "mongoose";

import { SEED_SERVICES } from "../helpers/seed-data";
import { Service } from "../models";

// `loadEnvFile` exists at runtime (Node 20.12+) but may be missing from the
// installed @types/node, so we access it through a narrow cast.
function loadLocalEnv() {
  const proc = process as typeof process & {
    loadEnvFile?: (path?: string) => void;
  };
  // Missing .env.local is fine: in Docker/CI the env is injected into the
  // process (loadEnvFile throws ENOENT when the file isn't there).
  try {
    proc.loadEnvFile?.(".env.local");
  } catch {
    // fall through to whatever is already in process.env
  }
}

async function seed() {
  loadLocalEnv();

  const uri = process.env.NEXT_MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Missing NEXT_MONGODB_URI. Copy .env.example to .env.local.",
    );
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const deleted = await Service.deleteMany({});
  console.log(`Cleared ${deleted.deletedCount} existing services`);

  const inserted = await Service.insertMany(SEED_SERVICES);
  console.log(`Inserted ${inserted.length} services`);

  // Builds the text/2dsphere/compound indexes the catalog search needs, and
  // drops any left over from an older schema. Doing it here (rather than
  // relying on Mongoose's autoIndex) keeps index builds an explicit,
  // deliberate step instead of something the first request triggers.
  const syncedIndexes = await Service.syncIndexes();
  console.log(
    syncedIndexes.length > 0
      ? `Synced indexes (dropped: ${syncedIndexes.join(", ")})`
      : "Synced indexes",
  );

  await mongoose.disconnect();
  console.log("Done");
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
