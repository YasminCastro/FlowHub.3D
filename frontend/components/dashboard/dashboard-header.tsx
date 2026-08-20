"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronRightIcon, LogOutIcon } from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function DashboardHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const isPerfil = pathname.startsWith("/dashboard/perfil");

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
    </header>
  );
}
