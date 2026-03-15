"use client";

import { Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeSwitcher } from "@/components/theme-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navItems = [
  {
    title: "Creators",
    href: "/dashboard/creators",
    icon: Users,
  },
];

export function AppSidebar({
  authButton,
}: {
  authButton: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <Link
          href="/dashboard/creators"
          className="flex items-center gap-2 px-2 py-1 font-semibold text-lg"
        >
          GoCreators
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.href)}
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
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
        </div>
        {authButton}
      </SidebarFooter>
    </Sidebar>
  );
}
