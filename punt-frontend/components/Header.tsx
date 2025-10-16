"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
// Dynamically import wallet button with SSR disabled to avoid markup mismatch.
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false, loading: () => <button className="!rounded-md !bg-[var(--accent)] !text-[var(--accent-contrast)] text-sm px-3 py-1 opacity-60" disabled>Wallet</button> }
);
import { WalletBalance } from "./WalletBalance";
import Image from "next/image";

export function Header() {
  const pathname = usePathname();
  const navLinks = [
    { href: "/", label: "Browse" },
    { href: "/buy", label: "Markets" },
    { href: "#", label: "Clips" },
  ];

  const isActive = (href: string) => {
    if (href === "#") return false;
    if (href === "/") {
      return pathname === "/";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header className="sticky top-0 z-40 w-full flex items-center gap-6 px-6 h-16 border-b border-white/10 bg-black/55 backdrop-blur-xl">
      <div className="flex items-center gap-6 flex-1 min-w-0">
        <Link href="/" className="flex items-center group" aria-label="Punt Home">
          <span className="relative inline-block w-32 h-9 sm:w-40 sm:h-10">
            <Image
              src="/logo.png"
              alt="Punt"
              fill
              priority
              unoptimized
              className="object-contain drop-shadow-md group-hover:brightness-110 transition"
              sizes="(max-width: 640px) 128px, 160px"
            />
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-3 text-xs font-medium">
          {navLinks.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative inline-flex items-center gap-1 rounded-md px-3 py-2 transition-colors text-dim ${
                  active
                    ? "bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_0_18px_rgba(255,223,0,0.18)]"
                    : "hover:text-white/90"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span>{label}</span>
                {active && <span className="absolute inset-x-2 -bottom-1 h-0.5 rounded-full bg-black/40" />}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3">
    <WalletBalance />
    <WalletMultiButton className="!rounded-md !px-4 !py-2 !h-auto !bg-[var(--accent)] hover:!brightness-110 !text-[var(--accent-contrast)] !text-xs !font-medium !border !border-white/10 !shadow-md" />
      </div>
    </header>
  );
}
