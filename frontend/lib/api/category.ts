import { apiFetch } from "./client";

export type Category = {
  id: string;
  name: string;
  color: string;
};

// Quantidade de peças marcadas com a categoria.
export type CategoryWithUsage = Category & { itemCount: number };

export type CategorySummary = { uncategorizedItems: number };

export async function listCategories() {
  return (await apiFetch("/category")) as CategoryWithUsage[];
}

export async function getCategorySummary() {
  return (await apiFetch("/category/summary")) as CategorySummary;
}

export async function createCategory(name: string, color: string) {
  const data = (await apiFetch("/category", {
    method: "POST",
    body: JSON.stringify({ name, color }),
  })) as { message: string; category: Category };
  return data.category;
}

export async function updateCategory(id: string, name: string, color: string) {
  const data = (await apiFetch(`/category/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name, color }),
  })) as { message: string; category: Category };
  return data.category;
}

export async function deleteCategory(id: string) {
  return (await apiFetch(`/category/${id}`, {
    method: "DELETE",
  })) as { message: string };
}
