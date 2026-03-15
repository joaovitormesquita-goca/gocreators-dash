import { AppSidebar } from "@/components/app-sidebar";
import { AuthButton } from "@/components/auth-button";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Suspense } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar
        authButton={
          <Suspense>
            <AuthButton />
          </Suspense>
        }
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium">Dashboard</span>
        </header>
        <div className="flex-1 px-4 md:px-6 py-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
