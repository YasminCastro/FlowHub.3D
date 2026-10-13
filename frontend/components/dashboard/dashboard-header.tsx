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

export function DashboardHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const headerAction = usePageHeaderActionSlot();
  const breadcrumb = usePageHeaderBreadcrumbSlot();

  const isPerfil = pathname.startsWith("/dashboard/perfil");
  const isConfigSection = CONFIG_TABS.some((tab) =>
    pathname.startsWith(tab.url),
  );

  const isEquipamentSection = EQUIPAMENT_TABS.some((tab) =>
    pathname.startsWith(tab.url),
  );

  const isJournalSection = pathname.startsWith("/dashboard/diario");

  return (
    <header className="flex h-12 items-center gap-2 border-b px-3">
      <SidebarTrigger />
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
                const isActive = pathname.startsWith(tab.url);
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
                const isActive = pathname.startsWith(tab.url);
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
    </header>
  );
}
