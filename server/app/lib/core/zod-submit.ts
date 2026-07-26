import type { NextResponse } from "next/server";
import type { ZodType } from "zod";

import { AbstractSubmitHandler, type SubmitError } from "./submit";

/**
 * A submit handler whose body is validated by a Zod schema.
 *
 * The hand-rolled `parseBody` checks in the auth handlers can only answer
 * "valid or not". Schemas know *which* field failed and why, so this base
 * keeps the issues around and surfaces them in `SubmitError.errors` — the
 * field-keyed shape the app already knows how to render.
 */
export abstract class ZodSubmitHandler<
  TData,
  TModel,
> extends AbstractSubmitHandler<TData, TModel> {
  /** Schema describing a valid request body. */
  protected abstract schema(): ZodType<TData>;

  /** Issues from the last `parseBody` call, keyed by field path. */
  private fieldErrors: Record<string, string[]> | null = null;

  parseBody(body: unknown): TData | null {
    const result = this.schema().safeParse(body);

    if (!result.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        // Object-level refinements have an empty path (e.g. "no fields to
        // update"); group those under `_` so nothing is silently dropped.
        const field = issue.path.join(".") || "_";
        (errors[field] ??= []).push(issue.message);
      }
      this.fieldErrors = errors;
      return null;
    }

    this.fieldErrors = null;
    return result.data;
  }

  protected validate(data: TData | null): NextResponse<SubmitError> | undefined {
    if (!data) {
      return this.handleError(
        {
          type: "VALIDATION_ERROR",
          message: "Invalid body",
          errors: this.fieldErrors ?? undefined,
        },
        400,
      );
    }
  }

  /**
   * Reads and validates the JSON body in one step. A malformed/absent JSON
   * payload is a 400 too — not the 500 that a thrown `request.json()` gives.
   */
  protected async parseRequest(
    request: Request,
  ): Promise<
    { ok: true; data: TData } | { ok: false; response: NextResponse<SubmitError> }
  > {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return {
        ok: false,
        response: this.handleError(
          { type: "BODY_ERROR", message: "Invalid JSON body" },
          400,
        ),
      };
    }

    const data = this.parseBody(body);
    const invalid = this.validate(data);
    if (invalid) return { ok: false, response: invalid };

    return { ok: true, data: data as TData };
  }
}
