"use client";

import { LayoutDashboard, TableProperties, BarChart3, CalendarDays, UserPlus, Building2, History } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navSections = [
  {
    label: "Dashboards",
    items: [
      {
        title: "Visão Geral",
        href: "/dashboard/overview",
        icon: LayoutDashboard,
      },
      {
        title: "Tabela Mensal",
        href: "/dashboard/creators",
        icon: TableProperties,
      },
      {
        title: "Visão Mensal",
        href: "/dashboard/monthly-view",
        icon: BarChart3,
      },
      {
        title: "Visão Diária",
        href: "/dashboard/daily-view",
        icon: CalendarDays,
      },
    ],
  },
  {
    label: "Gestão",
    items: [
      {
        title: "Gerenciar Creators",
        href: "/dashboard/creators/list",
        icon: UserPlus,
      },
      {
        title: "Marcas",
        href: "/dashboard/brands",
        icon: Building2,
      },
      {
        title: "Sincronização",
        href: "/dashboard/sync",
        icon: History,
      },
    ],
  },
];

export function AppSidebar({ user }: { user: { email: string } | null }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard/creators">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <span className="text-sm font-bold">G</span>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">GoCreators</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarMenu>
              {section.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.href === "/dashboard/creators"
                        ? pathname === "/dashboard/creators"
                        : pathname.startsWith(item.href)
                    }
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        {user ? (
          <NavUser user={user} />
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/auth/login">Sign in</Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
