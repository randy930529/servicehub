import { Model } from "mongoose";
import { NextResponse } from "next/server";

import { connectToDatabase } from "@/app/lib/mongoose";

/**
 * Configuration for submitting data to the server.
 */
export interface SubmitConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  endpoint: string;
}

/**
 * Error type for submitting data to the server.
 */
export interface SubmitError {
  type: "VALIDATION_ERROR" | "BODY_ERROR" | "UNKNOWN_ERROR";
  message: string;
  errors?: Record<string, any>;
}

/**
 * Base class for submitting data to the server.
 */
export abstract class AbstractSubmitHandler<TData, TModel> {
  protected config: SubmitConfig;
  protected data!: TData;
  protected modelo: Model<TModel>;

  constructor(modelo: Model<TModel>, config: SubmitConfig) {
    this.modelo = modelo;
    this.config = config;
  }

  /**
   * Set the data to be submitted.
   * @param body The request body.
   * @param parsedBody The parsed request body.
   */
  protected setData(parsedBody: TData) {
    this.data = parsedBody;
  }

  /**
   * Connect to the database.
   * @returns A promise that resolves when the connection is established.
   */
  protected async connect(): Promise<void> {
    await connectToDatabase();
  }

  /**
   * Handle an error that occurs during the submission process.
   * @param error The error that occurred.
   * @param statusCode The HTTP status code to return.
   * @returns A submit error response.
   */
  protected handleError(
    error: unknown,
    statusCode: number = 500,
  ): NextResponse<SubmitError> {
    let submitError: SubmitError;

    if (error instanceof Object && "type" in error) {
      submitError = error as SubmitError;
    } else {
      submitError = {
        type: "UNKNOWN_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      };

      console.error(
        `${this.config.method} ${this.config.endpoint} failed`,
        error,
      );
    }

    return NextResponse.json(submitError, { status: statusCode });
  }

  /**
   * Validate the data before submission.
   * @param data The data to validate.
   * @returns A submit error response if the data is invalid, or null if it is valid.
   */
  protected validate(data: TData | null) {
    if (!data) {
      return this.handleError(
        { type: "BODY_ERROR", message: "Invalid body" },
        400,
      );
    }
  }

  /**
   * Parse the request body into the expected data format.
   * @param body The request body.
   * @returns The parsed data, or null if parsing fails.
   */
  abstract parseBody(body: unknown): TData | null;

  /**
   * Submit data to the server.
   * @param data The data to submit.
   * @returns A promise that resolves to the submitted data.
   */
  abstract submit(request: Request): Promise<any>;
}
