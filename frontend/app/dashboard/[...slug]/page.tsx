import { notFound } from "next/navigation";

// Qualquer /dashboard/* sem rota cai aqui, para o 404 renderizar dentro do
// layout (com sidebar) em vez do 404 público da raiz.
export default function DashboardCatchAll() {
  notFound();
}
