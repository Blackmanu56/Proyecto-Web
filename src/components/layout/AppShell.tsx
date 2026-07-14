"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";

interface AppShellProps {
  user: {
    username: string;
    role: string;
    fotoUrl?: string | null;
  } | null;
  children: React.ReactNode;
}

export default function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();

  // No shell on login page
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // No shell if not authenticated
  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Navbar user={user} currentPath={pathname} />
      <main className="p-6">{children}</main>
    </div>
  );
}