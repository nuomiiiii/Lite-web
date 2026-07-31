import type { ReactNode } from "react";

export default function AdminPageTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-2xl font-bold text-foreground">{children}</h1>;
}
