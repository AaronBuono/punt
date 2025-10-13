"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
// Dynamically import wallet button with SSR disabled to avoid markup mismatch.
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false, loading: () => <button className="!rounded-md !bg-[var(--accent)] !text-white text-sm px-3 py-1 opacity-60" disabled>Wallet</button> }
);
import { WalletBalance } from "./WalletBalance";
import Image from "next/image";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full flex items-center gap-6 px-6 h-16 border-b border-white/10 bg-black/55 backdrop-blur-xl">
      <div className="flex items-center gap-6 flex-1 min-w-0">
        <Link href="/" className="flex items-center group" aria-label="Punt Home">
          <span className="relative inline-block w-32 h-9 sm:w-40 sm:h-10">
            <Image src="/logo.svg" alt="Punt" fill priority className="object-contain drop-shadow-md group-hover:brightness-110 transition" sizes="(max-width: 640px) 128px, 160px" />
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-4 text-xs font-medium text-dim">
          <Link href="#" className="relative hover:text-white transition">
            <span>Browse</span>
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-amber-400 transition-all group-hover:w-full" />
          </Link>
          <Link href="/buy" className="relative hover:text-white transition">
            <span>Buy</span>
          </Link>
          <Link href="#" className="relative hover:text-white transition">
            <span>Clips</span>
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <WalletBalance />
  <WalletMultiButton className="!rounded-md !px-4 !py-2 !h-auto !bg-[var(--accent)] hover:!brightness-110 !text-white !text-xs !font-medium !border !border-white/10 !shadow-md" />
      </div>
    </header>
  );
}
