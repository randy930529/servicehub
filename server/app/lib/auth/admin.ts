import { NextResponse } from "next/server";

import { authenticateRequest } from "./session";

type AdminResultType =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

/**
 * Guards the endpoints that move money backwards.
 *
 * A non-admin gets **404, not 403**: telling someone "this exists but you may
 * not use it" is an invitation. The route should look like it is not there.
 */
export async function requireAdmin(
  request: Request,
): Promise<AdminResultType> {
  const auth = await authenticateRequest(request);

  if (!auth.ok || auth.user.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }

  return { ok: true, userId: auth.user.id };
}
