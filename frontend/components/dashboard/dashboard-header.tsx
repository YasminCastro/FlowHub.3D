"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRightIcon, LogOutIcon } from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  usePageHeaderActionSlot,
  usePageHeaderBreadcrumbSlot,
} from "@/contexts/page-header-action-context";
import { cn } from "@/lib/utils";

const CONFIG_TABS = [
  { title: "Categorias", url: "/dashboard/categories" },
  { title: "Marcas", url: "/dashboard/marcas" },
  { title: "Itens extras", url: "/dashboard/itens-extras" },
  { title: "Custos e energia", url: "/dashboard/custos-energia" },
];

const EQUIPAMENT_TABS = [
  { title: "Impressoras", url: "/dashboard/printers" },
  { title: "Filamentos", url: "/dashboard/filamentos" },
];

const CALIBRATION_TABS = [
  { title: "Calibrações", url: "/dashboard/calibracoes" },
  { title: "Por fatiador", url: "/dashboard/fatiadores" },
  { title: "Flushing", url: "/dashboard/flushing" },
];

// Compara por segmento: "/dashboard/fila" não pode casar com
// "/dashboard/filamentos".
function isInSection(pathname: string, url: string) {
  return pathname === url || pathname.startsWith(`${url}/`);
}

export function DashboardHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const headerAction = usePageHeaderActionSlot();
  const breadcrumb = usePageHeaderBreadcrumbSlot();

  const isPerfil = isInSection(pathname, "/dashboard/perfil");
  const isConfigSection = CONFIG_TABS.some((tab) =>
    isInSection(pathname, tab.url),
  );

  const isEquipamentSection = EQUIPAMENT_TABS.some((tab) =>
    isInSection(pathname, tab.url),
  );

  const isJournalSection = isInSection(pathname, "/dashboard/diario");
  const isPrintSection = isInSection(pathname, "/dashboard/impressoes");
  const isQueueSection = isInSection(pathname, "/dashboard/fila");
  const isCatalogSection = isInSection(pathname, "/dashboard/catalogo");
  const isCalibrationSection = CALIBRATION_TABS.some((tab) =>
    isInSection(pathname, tab.url),
  );

  const isHome = pathname === "/dashboard";

  // Nenhuma seção conhecida: é a URL inexistente que caiu no 404 do dashboard.
  const isUnknownPath =
    !isHome &&
    !isPerfil &&
    !isConfigSection &&
    !isEquipamentSection &&
    !isJournalSection &&
    !isPrintSection &&
    !isQueueSection &&
    !isCatalogSection &&
    !isCalibrationSection;

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
      <SidebarTrigger />
      {isUnknownPath && (
        <span className="text-sm text-muted-foreground">
          Página não encontrada
        </span>
      )}
      {isHome && (
        <>
          <span className="text-sm font-medium">Início</span>
          {headerAction && (
            <div className="ml-auto flex items-center gap-2">
              {headerAction}
            </div>
          )}
        </>
      )}
      {isPerfil && (
        <>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Conta</span>
            <ChevronRightIcon className="size-3.5 text-muted-foreground" />
            <span className="font-medium">Perfil</span>
          </div>
          <button
            type="button"
            className="ml-auto flex cursor-pointer items-center gap-1.5 text-sm text-brand hover:opacity-80"
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
          >
            <LogOutIcon className="size-3.5" />
            Sair
          </button>
        </>
      )}

      {isConfigSection && (
        <>
          {breadcrumb ? (
            <div className="flex items-center gap-1.5 text-sm">
              {breadcrumb}
            </div>
          ) : (
            <nav className="flex h-full items-stretch gap-4">
              {CONFIG_TABS.map((tab) => {
                const isActive = isInSection(pathname, tab.url);
                return (
                  <Link
                    key={tab.url}
                    href={tab.url}
                    className={cn(
                      "flex items-center border-b-2 border-transparent text-sm text-muted-foreground transition-colors hover:text-foreground",
                      isActive && "border-brand font-medium text-foreground",
                    )}
                  >
                    {tab.title}
                  </Link>
                );
              })}
            </nav>
          )}
          {headerAction && <div className="ml-auto">{headerAction}</div>}
        </>
      )}

      {isEquipamentSection && (
        <>
          {breadcrumb ? (
            <div className="flex items-center gap-1.5 text-sm">
              {breadcrumb}
            </div>
          ) : (
            <nav className="flex h-full items-stretch gap-4">
              {EQUIPAMENT_TABS.map((tab) => {
                const isActive = isInSection(pathname, tab.url);
                return (
                  <Link
                    key={tab.url}
                    href={tab.url}
                    className={cn(
                      "flex items-center border-b-2 border-transparent text-sm text-muted-foreground transition-colors hover:text-foreground",
                      isActive && "border-brand font-medium text-foreground",
                    )}
                  >
                    {tab.title}
                  </Link>
                );
              })}
            </nav>
          )}
          {headerAction && (
            <div className="ml-auto flex items-center gap-2">
              {headerAction}
            </div>
          )}
        </>
      )}

      {isJournalSection && (
        <>
          <div className="flex min-w-0 items-center gap-1.5 text-sm">
            {breadcrumb ?? <span className="font-medium">Diário</span>}
          </div>
          {headerAction && (
            <div className="ml-auto flex items-center gap-2">
              {headerAction}
            </div>
          )}
        </>
      )}

      {isPrintSection && (
        <>
          <div className="flex min-w-0 items-center gap-1.5 text-sm">
            {breadcrumb ?? <span className="font-medium">Impressões</span>}
          </div>
          {headerAction && (
            <div className="ml-auto flex items-center gap-2">
              {headerAction}
            </div>
          )}
        </>
      )}

      {isQueueSection && (
        <>
          <div className="flex min-w-0 items-center gap-1.5 text-sm">
            {breadcrumb ?? (
              <span className="font-medium">Fila de impressão</span>
            )}
          </div>
          {headerAction && (
            <div className="ml-auto flex items-center gap-2">
              {headerAction}
            </div>
          )}
        </>
      )}

      {isCatalogSection && (
        <>
          <div className="flex min-w-0 items-center gap-1.5 text-sm">
            {breadcrumb ?? <span className="font-medium">Catálogo</span>}
          </div>
          {headerAction && (
            <div className="ml-auto flex items-center gap-2">
              {headerAction}
            </div>
          )}
        </>
      )}

      {isCalibrationSection && (
        <>
          {breadcrumb ? (
            <div className="flex min-w-0 items-center gap-1.5 text-sm">
              {breadcrumb}
            </div>
          ) : (
            <nav className="flex h-full items-stretch gap-4">
              {CALIBRATION_TABS.map((tab) => {
                const isActive = isInSection(pathname, tab.url);
                return (
                  <Link
                    key={tab.url}
                    href={tab.url}
                    className={cn(
                      "flex items-center border-b-2 border-transparent text-sm text-muted-foreground transition-colors hover:text-foreground",
                      isActive && "border-brand font-medium text-foreground",
                    )}
                  >
                    {tab.title}
                  </Link>
                );
              })}
            </nav>
          )}
          {headerAction && (
            <div className="ml-auto flex items-center gap-2">
              {headerAction}
            </div>
          )}
        </>
      )}
    </header>
  );
}
