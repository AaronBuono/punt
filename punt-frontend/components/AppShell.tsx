"use client";
import { ReactNode } from "react";
import { Providers } from "./Providers";
// import { Header } from "./Header";
import { TwitchHeader } from "./TwitchHeader";
// Live Hosts sidebar removed globally per design decision

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen flex flex-col">
        <TwitchHeader />
        <div className="flex w-full flex-1 min-h-0">
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </Providers>
  );
}
