"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRightIcon,
  ChevronsUpDownIcon,
  CircleHelpIcon,
  LogOutIcon,
  UserIcon,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function NavUser() {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  const displayName = user.name ?? user.email;
  const initials = displayName.slice(0, 1).toUpperCase();
  const isActive = pathname.startsWith("/dashboard/perfil");

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className={cn(
                  "rounded-lg pl-2.5 data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground",
                  isActive && "border-l-2 border-brand bg-sidebar-accent/60",
                )}
              />
            }
          >
            <Avatar className="rounded-full">
              <AvatarFallback className="rounded-full bg-brand/15 text-brand">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{displayName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-64 rounded-xl p-2"
            side={isMobile ? "bottom" : "top"}
            align="end"
            sideOffset={4}
          >
            <div className="flex items-center gap-2.5 px-1.5 py-1.5">
              <Avatar size="lg" className="rounded-full">
                <AvatarFallback className="rounded-full bg-brand/15 text-brand">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => router.push("/dashboard/perfil")}
            >
              <UserIcon />
              Perfil
            </DropdownMenuItem>
            {/* <DropdownMenuItem className="cursor-pointer">
              <CircleHelpIcon />
              Ajuda
            </DropdownMenuItem> */}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="cursor-pointer"
              onClick={async () => {
                await logout();
                router.push("/login");
              }}
            >
              <LogOutIcon />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
