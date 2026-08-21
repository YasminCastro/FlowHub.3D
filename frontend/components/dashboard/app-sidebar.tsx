"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GaugeIcon,
  ImagesIcon,
  LayoutGridIcon,
  LayersIcon,
  ListOrderedIcon,
  NotebookIcon,
  PackageIcon,
  PrinterIcon,
  ShoppingBagIcon,
  SlidersHorizontalIcon,
  TagIcon,
  ZapIcon,
} from "lucide-react";

import { NavUser } from "@/components/dashboard/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Logo } from "../logo";

const navGroups = [
  {
    label: "GERAL",
    items: [{ title: "Início", url: "/dashboard", icon: LayoutGridIcon }],
  },
  {
    label: "IMPRESSÃO",
    items: [
      {
        title: "Impressões",
        url: "/dashboard/impressoes",
        icon: ImagesIcon,
      },
      {
        title: "Fila de Impressão",
        url: "/dashboard/fila",
        icon: ListOrderedIcon,
      },
      {
        title: "Diário",
        url: "/dashboard/diario",
        icon: NotebookIcon,
      },
    ],
  },
  {
    label: "EQUIPAMENTO",
    items: [
      {
        title: "Impressoras",
        url: "/dashboard/printers",
        icon: PrinterIcon,
      },
      { title: "Filamentos", url: "/dashboard/filamentos", icon: LayersIcon },
    ],
  },
  {
    label: "CALIBRAÇÃO",
    items: [
      {
        title: "Calibrações",
        url: "/dashboard/calibracoes",
        icon: GaugeIcon,
      },
      {
        title: "Por Fatiador",
        url: "/dashboard/fatiadores",
        icon: SlidersHorizontalIcon,
      },
    ],
  },
  {
    label: "CONFIGURAÇÕES",
    items: [
      { title: "Categorias", url: "/dashboard/categories", icon: TagIcon },
      { title: "Marcas", url: "/dashboard/marcas", icon: PackageIcon },
      {
        title: "Itens Extras",
        url: "/dashboard/itens-extras",
        icon: ShoppingBagIcon,
      },
      {
        title: "Custos e energia",
        url: "/dashboard/custos-energia",
        icon: ZapIcon,
      },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <Logo />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-muted-foreground">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      isActive={pathname === item.url}
                      tooltip={item.title}
                      className="data-active:bg-brand/12 data-active:text-brand data-active:shadow-[inset_2px_0_0_0_var(--brand)]"
                      render={<Link href={item.url} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
