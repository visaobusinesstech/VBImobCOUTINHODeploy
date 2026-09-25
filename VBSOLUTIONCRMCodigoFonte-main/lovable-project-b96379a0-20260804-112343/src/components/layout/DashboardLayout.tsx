import { ReactNode } from "react";
import { AppSidebar, TopBar } from "./AppLayout";
import { SecurityModeBanner } from "./SecurityModeBanner";
import { ByokBanner } from "./ByokBanner";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-dvh flex flex-col">
      <SecurityModeBanner />
      <ByokBanner />
      <div className="flex-1 flex">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 transition-[margin] duration-300 xl:ml-[260px]">
          <TopBar />
          <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto safe-x">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}


