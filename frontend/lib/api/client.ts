const API_URL = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** O backend responde 404 quando o registro não existe ou não é do usuário. */
export function isNotFoundError(err: unknown) {
  return err instanceof ApiError && err.status === 404;
}

// Access token lives only in memory (never localStorage) so it can't be
// read by an XSS payload. Session persistence across reloads comes from
// the httpOnly refresh-token cookie via refreshAccessToken().
let accessToken: string | null = null;
const tokenListeners = new Set<(token: string | null) => void>();

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  tokenListeners.forEach((listener) => listener(token));
}

// O AuthContext acompanha as renovações feitas aqui dentro (e a sessão que
// expirou de vez), sem precisar recarregar a página.
export function onAccessTokenChange(listener: (token: string | null) => void) {
  tokenListeners.add(listener);
  return () => {
    tokenListeners.delete(listener);
  };
}

// O backend troca o refresh token a cada renovação: duas em paralelo fariam a
// segunda chegar com o cookie já invalidado. Quem pedir durante uma renovação
// espera a mesma.
let refreshing: Promise<string | null> | null = null;

export function refreshAccessToken() {
  refreshing ??= requestNewAccessToken().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function requestNewAccessToken() {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    setAccessToken(null);
    return null;
  }

  if (!res.ok) {
    setAccessToken(null);
    return null;
  }

  const data = (await res.json()) as { accessToken: string };
  setAccessToken(data.accessToken);
  return data.accessToken;
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
    throw new ApiError(message, res.status);
  }

  return data;
}

// Shared fetch wrapper: attaches the in-memory access token (once logged in)
// and always sends the httpOnly refresh cookie, so callers never handle
// auth headers themselves.
export async function apiFetch(path: string, init: RequestInit = {}) {
  const sentToken = accessToken;
  let res = await send(path, init, sentToken);

  // O access token dura pouco (15 min). Expirou no meio do uso: renova pelo
  // cookie e tenta de novo uma vez. Sem token (login, cadastro) o 401 é
  // resposta de verdade.
  if (res.status === 401 && sentToken) {
    // Outra requisição pode já ter renovado enquanto esta estava no ar.
    const token =
      accessToken && accessToken !== sentToken
        ? accessToken
        : await refreshAccessToken();
    if (token) res = await send(path, init, token);
  }

  return parseResponse(res);
}

function send(path: string, init: RequestInit, token: string | null) {
  const headers = new Headers(init.headers);
  // Upload (FormData): o navegador monta o Content-Type com o boundary.
  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
}
