import {
  MEMORIES_ADMIN_PAGE_PATH,
  MEMORIES_ADMIN_SESSION_PATH,
} from "../admin-route-paths.mjs";
import { adminRequest } from "./admin-client.mjs";

const RETRY_DELAYS_MS = [400, 1_000];

export function retryableAdministratorLoginError(error) {
  if (error?.code === "REQUEST_TIMEOUT") return true;
  if ([502, 503, 504].includes(Number(error?.status))) return true;
  return error instanceof TypeError || error?.name === "TypeError";
}

export async function loginAdministrator(
  password,
  {
    request = adminRequest,
    navigate = (destination) => globalThis.location.replace(destination),
    wait = (delayMs) => new Promise((resolve) => globalThis.setTimeout(resolve, delayMs)),
    onRetry = () => {},
  } = {},
) {
  let result;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      result = await request(MEMORIES_ADMIN_SESSION_PATH, {
        method: "POST",
        password,
        timeoutMs: 8_000,
      });
      break;
    } catch (error) {
      const canRetry =
        attempt < RETRY_DELAYS_MS.length && retryableAdministratorLoginError(error);
      if (!canRetry) throw error;
      onRetry({ attempt: attempt + 1, error });
      await wait(RETRY_DELAYS_MS[attempt]);
    }
  }

  if (!result?.authenticated) {
    const error = new Error("Administrator login failed");
    error.code = "UNAUTHORIZED";
    throw error;
  }
  navigate(MEMORIES_ADMIN_PAGE_PATH);
}
