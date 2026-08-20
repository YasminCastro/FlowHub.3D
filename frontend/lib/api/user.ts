import { apiFetch } from "./client";

export async function updateUser(id: string, name: string) {
  return (await apiFetch(`/user/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  })) as { id: string; email: string; name: string | null };
}

export async function deleteUser(id: string, password: string) {
  return (await apiFetch(`/user/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ password }),
  })) as { id: string; email: string; name: string | null };
}
