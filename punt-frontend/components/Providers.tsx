"use client";
import { ReactNode } from "react";
import { WalletContextProvider } from "./WalletContextProvider";
import { ToastProvider } from "./ToastProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WalletContextProvider>
      <ToastProvider>{children}</ToastProvider>
    </WalletContextProvider>
  );
}
