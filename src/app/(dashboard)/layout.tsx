import type { ReactNode } from "react";
import { AuthGate } from "@/components/auth-gate";
import { CoffeeBreakApp } from "@/components/coffee-break-app";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AuthGate><CoffeeBreakApp />{children}</AuthGate>;
}
