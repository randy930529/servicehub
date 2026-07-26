import { NextResponse } from "next/server";
import type { ZodType } from "zod";

import {
  authenticateRequest,
  getBearerToken,
  toPublicUser,
} from "@/app/lib/auth";
import {
  AbstractSubmitHandler,
  ZodSubmitHandler,
  type SubmitError,
} from "@/app/lib/core";
import { User, UserDocument } from "@/app/lib/models";
import {
  createAvatarUploadUrl,
  deleteAvatarObject,
  getAvatarMaxBytes,
  headAvatarObject,
  isAllowedAvatarContentType,
  isOwnedAvatarKey,
} from "@/app/lib/storage";
import {
  AvatarConfirmSchema,
  UpdateProfileSchema,
  buildAvatarUploadRequestSchema,
  type AvatarConfirmInputType,
  type AvatarUploadRequestInputType,
  type UpdateProfileInputType,
} from "@/app/lib/validation";

/** 401 body shared by every profile endpoint, in the standard error shape. */
function authError(reason: "missing" | "invalid"): NextResponse<SubmitError> {
  return NextResponse.json(
    {
      type: "VALIDATION_ERROR",
      message:
        reason === "missing"
          ? "Missing access token"
          : "Invalid or expired access token",
    },
    { status: 401 },
  );
}

/** Deleting a superseded object must never fail the request that replaced it. */
function deleteInBackground(key: string) {
  void deleteAvatarObject(key).catch((error) => {
    console.error(`Failed to delete avatar object ${key}`, error);
  });
}

/** `GET /api/users/me` — the authenticated user's profile. */
export class GetProfile extends AbstractSubmitHandler<string, UserDocument> {
  constructor(config: { endpoint: string; method: "GET" }) {
    super(User, config);
  }

  // No body: the bearer token is the whole input (same shape as UserMe).
  parseBody(request: Request) {
    return getBearerToken(request);
  }

  async submit(request: Request) {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authError(auth.reason);

    return NextResponse.json({ user: toPublicUser(auth.user) });
  }
}

/** `PATCH /api/users/me` — partial update of name/bio/phone. */
export class UpdateProfile extends ZodSubmitHandler<
  UpdateProfileInputType,
  UserDocument
> {
  constructor(config: { endpoint: string; method: "PATCH" }) {
    super(User, config);
  }

  protected schema(): ZodType<UpdateProfileInputType> {
    return UpdateProfileSchema;
  }

  async submit(request: Request) {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authError(auth.reason);

    const parsed = await this.parseRequest(request);
    if (!parsed.ok) return parsed.response;

    this.setData(parsed.data);

    // Assign only the keys actually sent, so a PATCH never blanks a field the
    // client didn't mention.
    const { name, bio, phone } = parsed.data;
    if (name !== undefined) auth.user.name = name;
    if (bio !== undefined) auth.user.bio = bio;
    if (phone !== undefined) auth.user.phone = phone;
    await auth.user.save();

    return NextResponse.json({ user: toPublicUser(auth.user) });
  }
}

/**
 * `POST /api/users/me/avatar/upload-url` — hands back a presigned PUT so the
 * app uploads straight to storage; the image bytes never touch this server.
 */
export class CreateAvatarUploadUrl extends ZodSubmitHandler<
  AvatarUploadRequestInputType,
  UserDocument
> {
  constructor(config: { endpoint: string; method: "POST" }) {
    super(User, config);
  }

  protected schema(): ZodType<AvatarUploadRequestInputType> {
    return buildAvatarUploadRequestSchema();
  }

  async submit(request: Request) {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authError(auth.reason);

    const parsed = await this.parseRequest(request);
    if (!parsed.ok) return parsed.response;

    this.setData(parsed.data);

    const target = await createAvatarUploadUrl(
      auth.user.id,
      parsed.data.contentType,
    );

    return NextResponse.json({ ...target, maxBytes: getAvatarMaxBytes() });
  }
}

/**
 * `PUT /api/users/me/avatar` — confirms an upload and points the user at it.
 *
 * The client is not trusted here: the key must live under the caller's own
 * prefix, and the object is inspected in storage to check it really exists and
 * respects the type/size limits before it becomes the user's avatar.
 */
export class ConfirmAvatar extends ZodSubmitHandler<
  AvatarConfirmInputType,
  UserDocument
> {
  constructor(config: { endpoint: string; method: "PUT" }) {
    super(User, config);
  }

  protected schema(): ZodType<AvatarConfirmInputType> {
    return AvatarConfirmSchema;
  }

  async submit(request: Request) {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authError(auth.reason);

    const parsed = await this.parseRequest(request);
    if (!parsed.ok) return parsed.response;

    this.setData(parsed.data);
    const { key } = parsed.data;

    if (!isOwnedAvatarKey(key, auth.user.id)) {
      return this.handleError(
        { type: "VALIDATION_ERROR", message: "Key does not belong to you" },
        403,
      );
    }

    const object = await headAvatarObject(key);
    if (!object) {
      return this.handleError(
        { type: "VALIDATION_ERROR", message: "No upload found for that key" },
        400,
      );
    }

    // The presigned URL only constrains the content type, so the real size is
    // checked here — and an over-limit upload is evicted rather than kept.
    const maxBytes = getAvatarMaxBytes();
    if (object.contentLength > maxBytes) {
      deleteInBackground(key);
      return this.handleError(
        {
          type: "VALIDATION_ERROR",
          message: `Image is larger than ${maxBytes} bytes`,
        },
        413,
      );
    }

    if (object.contentType && !isAllowedAvatarContentType(object.contentType)) {
      deleteInBackground(key);
      return this.handleError(
        {
          type: "VALIDATION_ERROR",
          message: "Unsupported image type. Use JPEG, PNG or WebP",
        },
        415,
      );
    }

    const previousKey = auth.user.avatarKey;
    auth.user.avatarKey = key;
    await auth.user.save();

    // Only after the new key is safely persisted — otherwise a failed save
    // would leave the user pointing at a deleted object.
    if (previousKey && previousKey !== key) deleteInBackground(previousKey);

    return NextResponse.json({ user: toPublicUser(auth.user) });
  }
}

/** `DELETE /api/users/me/avatar` — back to the initials placeholder. */
export class DeleteAvatar extends AbstractSubmitHandler<string, UserDocument> {
  constructor(config: { endpoint: string; method: "DELETE" }) {
    super(User, config);
  }

  parseBody(request: Request) {
    return getBearerToken(request);
  }

  async submit(request: Request) {
    const auth = await authenticateRequest(request);
    if (!auth.ok) return authError(auth.reason);

    // Idempotent: removing an avatar that isn't there is still a success.
    const previousKey = auth.user.avatarKey;
    if (previousKey) {
      auth.user.avatarKey = null;
      await auth.user.save();
      deleteInBackground(previousKey);
    }

    return NextResponse.json({ user: toPublicUser(auth.user) });
  }
}
