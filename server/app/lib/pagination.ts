/**
 * Pure pagination helpers — no DB or framework deps, so they're trivially
 * unit-testable.
 */

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationMeta extends PaginationParams {
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * Parses raw `page`/`limit` query params into safe, bounded integers.
 * Invalid, missing or out-of-range values fall back to sane defaults.
 */
export function parsePagination(input: {
  page?: string | null;
  limit?: string | null;
}): PaginationParams {
  const page = toPositiveInt(input.page, DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, toPositiveInt(input.limit, DEFAULT_LIMIT));
  return { page, limit };
}

/** How many documents to skip for a given page/limit. */
export function getSkip({ page, limit }: PaginationParams): number {
  return (page - 1) * limit;
}

/** Builds the pagination metadata block returned to clients. */
export function buildMeta(
  { page, limit }: PaginationParams,
  total: number,
): PaginationMeta {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

function toPositiveInt(value: string | null | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}
