import { NextResponse } from "next/server";

import { AbstractSubmitHandler } from "@/app/lib/core";
import { UserType } from "@/app/lib/definitions";
import { User, UserDocument } from "@/app/lib/models";
import {
  getBearerToken,
  hashPassword,
  hashRefreshToken,
  issueSession,
  toPublicUser,
  verifyAccessToken,
  verifyPassword,
} from "@/app/lib/auth";

export class Register extends AbstractSubmitHandler<UserType, UserDocument> {
  constructor(config: { endpoint: string; method: "POST" }) {
    super(User, config);
  }

  parseBody(body: unknown): UserType | null {
    if (typeof body !== "object" || body === null) return null;
    const { name, email, password } = body as Record<string, unknown>;
    if (typeof name !== "string" || name.trim().length < 2) return null;
    if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) return null;
    if (typeof password !== "string" || password.length < 6) return null;
    return { name: name.trim(), email: email.toLowerCase().trim(), password };
  }

  async submit(request: Request) {
    const data = this.parseBody(await request.json());
    const isDataNotValid = this.validate(data);
    if (isDataNotValid) return isDataNotValid;

    this.setData(data as UserType);
    await this.connect();

    const existing = await this.modelo.findOne({
      email: this.data?.email,
    });
    if (existing) {
      return this.handleError(
        { type: "VALIDATION_ERROR", message: "Email already registered" },
        409,
      );
    }

    const { name, email, password } = this.data;
    const user = await this.modelo.create({
      name,
      email,
      passwordHash: await hashPassword(password),
    });

    return NextResponse.json(await issueSession(user), { status: 201 });
  }
}

export class Login extends AbstractSubmitHandler<UserType, UserDocument> {
  constructor(config: { endpoint: string; method: "POST" }) {
    super(User, config);
  }

  parseBody(body: unknown): UserType | null {
    if (typeof body !== "object" || body === null) return null;
    const { email, password } = body as Record<string, unknown>;
    if (typeof email !== "string" || typeof password !== "string") return null;
    return { name: "", email: email.toLowerCase().trim(), password };
  }

  async submit(request: Request) {
    const data = this.parseBody(await request.json());
    const isDataNotValid = this.validate(data);
    if (isDataNotValid) return isDataNotValid;

    this.setData(data as UserType);
    await this.connect();

    const { email, password } = this.data;
    const user = await User.findOne({ email });
    const isPasswordValid =
      !user || !(await verifyPassword(password, user.passwordHash));
    if (isPasswordValid) {
      return this.handleError(
        { type: "VALIDATION_ERROR", message: "Invalid credentials" },
        401,
      );
    }

    return NextResponse.json(await issueSession(user));
  }
}

export class Logout extends AbstractSubmitHandler<
  { refreshToken: string },
  UserDocument
> {
  constructor(config: { endpoint: string; method: "POST" }) {
    super(User, config);
  }

  parseBody(body: unknown): { refreshToken: string } | null {
    if (typeof body !== "object" || body === null) return null;
    const { refreshToken } = body as Record<string, unknown>;
    if (typeof refreshToken !== "string" || refreshToken.length === 0)
      return null;
    return { refreshToken };
  }

  async submit(request: Request) {
    const data = this.parseBody(await request.json());
    const isDataNotValid = this.validate(data);
    if (isDataNotValid) return isDataNotValid;

    this.setData(data as { refreshToken: string });
    await this.connect();

    // Idempotent: revoking an unknown/already-revoked token is still a 204,
    // so logout never fails client-side.
    const { refreshToken } = this.data;
    const refreshTokenHash = hashRefreshToken(refreshToken);
    await User.updateOne(
      { "refreshTokens.tokenHash": refreshTokenHash },
      { $pull: { refreshTokens: { tokenHash: refreshTokenHash } } },
    );

    return new NextResponse(null, { status: 204 });
  }
}

export class Refresh extends AbstractSubmitHandler<
  { refreshToken: string },
  UserDocument
> {
  constructor(config: { endpoint: string; method: "POST" }) {
    super(User, config);
  }

  parseBody(body: unknown): { refreshToken: string } | null {
    if (typeof body !== "object" || body === null) return null;
    const { refreshToken } = body as Record<string, unknown>;
    if (typeof refreshToken !== "string" || refreshToken.length === 0)
      return null;
    return { refreshToken };
  }

  async submit(request: Request) {
    const data = this.parseBody(await request.json());
    const isDataNotValid = this.validate(data);
    if (isDataNotValid) return isDataNotValid;

    this.setData(data as { refreshToken: string });
    await this.connect();

    const { refreshToken } = this.data;
    const tokenHash = hashRefreshToken(refreshToken);
    const user = await User.findOne({
      refreshTokens: {
        $elemMatch: { tokenHash, expiresAt: { $gt: new Date() } },
      },
    });
    if (!user) {
      return this.handleError(
        { type: "VALIDATION_ERROR", message: "Invalid refresh token" },
        401,
      );
    }

    // Rotation: issueSession drops this hash and stores a fresh one.
    return NextResponse.json(await issueSession(user, tokenHash));
  }
}

export class UserMe extends AbstractSubmitHandler<string, UserDocument> {
  constructor(config: { endpoint: string; method: "GET" }) {
    super(User, config);
  }

  parseBody(request: Request) {
    return getBearerToken(request);
  }

  protected validate(token: string | null) {
    if (!token) {
      return this.handleError(
        { type: "VALIDATION_ERROR", message: "Missing access token" },
        401,
      );
    }
  }

  async submit(request: Request) {
    const token = this.parseBody(request);
    const isTokenNotValid = this.validate(token);
    if (isTokenNotValid) return isTokenNotValid;

    const claims = token ? await verifyAccessToken(token) : null;
    if (!claims) {
      return this.handleError(
        {
          type: "VALIDATION_ERROR",
          message: "Invalid or expired access token",
        },
        401,
      );
    }

    this.setData(token as string);
    await this.connect();

    const user = await User.findById(claims.sub);
    if (!user) {
      return this.handleError(
        {
          type: "VALIDATION_ERROR",
          message: "Invalid or expired access token",
        },
        401,
      );
    }

    return NextResponse.json({ user: toPublicUser(user) });
  }
}
