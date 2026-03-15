import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import Link from "next/link";
import { Suspense } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/40">
        <div className="container flex h-14 items-center justify-between px-4 md:px-6">
          <Link href="/dashboard/creators" className="font-semibold text-lg">
            GoCreators
          </Link>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            <Suspense>
              <AuthButton />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="flex-1 container px-4 md:px-6 py-6">{children}</main>
    </div>
  );
}
