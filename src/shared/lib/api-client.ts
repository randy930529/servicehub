import axios from "axios";

import { getApiBaseUrl } from "./api-config";

/**
 * Shared Axios instance for the ServiceHub backend. Feature data layers (e.g.
 * services use-cases) call the API through this client so base URL, timeout and
 * future concerns (auth headers, interceptors) live in one place.
 */
export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});
