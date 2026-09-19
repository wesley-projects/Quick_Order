const DEFAULT_TIMEOUT_MS = 10_000;

export function checkerUserAgent(): string {
  return (
    process.env.CHECKER_USER_AGENT ??
    "RestockRadar/0.1 (restock monitor; set CHECKER_USER_AGENT to identify yourself)"
  );
}

/**
 * fetch with a hard timeout. A retailer that hangs must not hold up the rest
 * of the cycle, and an AbortController is the only way to guarantee that.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "user-agent": checkerUserAgent(),
        accept: "application/json,text/html;q=0.9",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}
