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

export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const data = (await parseResponse(res)) as {
    message: string;
    accessToken: string;
  };
  setAccessToken(data.accessToken);
  return data;
}

export async function refreshAccessToken() {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    setAccessToken(null);
    return null;
  }

  const data = (await res.json()) as { accessToken: string };
  setAccessToken(data.accessToken);
  return data.accessToken;
}

export async function logout() {
  await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => null);
  setAccessToken(null);
}
