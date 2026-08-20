const API_URL = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {}

// Access token lives only in memory (never localStorage) so it can't be
// read by an XSS payload. Session persistence across reloads comes from
// the httpOnly refresh-token cookie via refreshAccessToken().
let accessToken: string | null = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

// Decodes the JWT payload for display purposes only (e.g. showing the
// user's email in the UI). Never trust this client-side for authorization —
// the backend is the source of truth for token validity.
export function decodeAccessToken(token: string) {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json as { sub: string; email: string; name: string | null };
  } catch {
    return null;
  }
}

async function parseResponse(res: Response) {
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : (data?.message ?? "Não foi possível completar a requisição.");
    throw new ApiError(message);
  }

  return data;
}

// Shared fetch wrapper: attaches the in-memory access token (once logged in)
// and always sends the httpOnly refresh cookie, so callers never handle
// auth headers themselves.
export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  return parseResponse(res);
}
