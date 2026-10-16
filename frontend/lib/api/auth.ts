import { apiFetch, setAccessToken } from "./client";

export {
  ApiError,
  getAccessToken,
  setAccessToken,
  decodeAccessToken,
  onAccessTokenChange,
  refreshAccessToken,
} from "./client";

export async function signup(email: string, password: string, name?: string) {
  return (await apiFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  })) as { message: string; user: string };
}

export async function login(email: string, password: string) {
  const data = (await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })) as { message: string; accessToken: string };
  setAccessToken(data.accessToken);
  return data;
}

export async function verifyEmail(email: string, code: string) {
  const data = (await apiFetch("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  })) as { message: string; accessToken: string };
  setAccessToken(data.accessToken);
  return data;
}

export async function resendCode(email: string) {
  return (await apiFetch("/auth/resend-code", {
    method: "POST",
    body: JSON.stringify({ email }),
  })) as { message: string };
}

export async function forgotPassword(email: string) {
  return (await apiFetch("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  })) as { message: string };
}

export async function resetPassword(
  email: string,
  code: string,
  newPassword: string,
) {
  return (await apiFetch("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, code, newPassword }),
  })) as { message: string };
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
) {
  return (await apiFetch("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  })) as { message: string };
}

export async function logout() {
  await apiFetch("/auth/logout", { method: "POST" }).catch(() => null);
  setAccessToken(null);
}
