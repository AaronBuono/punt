"use client";
import { Menu, Compass, ShoppingBag, Video, X } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { WalletBalance } from "./WalletBalance";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Wallet button SSR-safe
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false, loading: () => <button className="!rounded-md !bg-[var(--accent)] !text-[var(--accent-contrast)] text-xs px-3 py-1 opacity-60" disabled>Wallet</button> }
);

export function TwitchHeader() {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);
  const navLinks = [
    { href: "/", label: "Browse", icon: Compass },
    { href: "/buy", label: "Markets", icon: ShoppingBag },
    { href: "/apply", label: "Apply to Stream", icon: Video },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  useEffect(() => {
    const updateWidth = () => setViewportWidth(window.innerWidth);
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const hideStudioLink = viewportWidth !== null && viewportWidth < 1180;
  const hideBalance = viewportWidth !== null && viewportWidth < 1080;
  const collapseNav = viewportWidth !== null && viewportWidth < 960;
  const showMenuButton = viewportWidth === null
    ? false
    : viewportWidth < 1024 || hideStudioLink || hideBalance || collapseNav;

  useEffect(() => {
    if (!showMenuButton && mobileNavOpen) {
      setMobileNavOpen(false);
    }
  }, [showMenuButton, mobileNavOpen]);

  const showStudioLink = !hideStudioLink;
  const showWalletBalance = !hideBalance;
  const showNavLinksInDropdown = collapseNav || (viewportWidth !== null ? viewportWidth < 768 : true);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const mobileNavId = "punt-mobile-nav";
  const menuButtonHidden = !showMenuButton && !mobileNavOpen;

  return (
    <motion.header
  className="bg-[#0E1525]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0E1525]/80 sticky top-0 z-40 border-b border-white/10 px-4 py-2 flex items-center justify-between relative"
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      {/* removed animated backdrop */}

      {/* Left: Single SVG logo */}
      <div className="flex items-center gap-3 relative z-10">
        <Link href="/" className="flex items-center group" aria-label="Punt Home">
          <span className="relative inline-block w-32 h-10 sm:w-44 sm:h-12">
            <Image src="/logo.svg" alt="Punt" fill priority className="object-contain drop-shadow" sizes="(max-width: 640px) 128px, 176px" />
          </span>
        </Link>
      </div>

      {/* Center: nav buttons (md+) */}
      <nav className={`${collapseNav ? "hidden" : "hidden md:flex"} items-center gap-3 absolute left-1/2 -translate-x-1/2 z-10`}>
        {navLinks.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-transparent bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_0_18px_rgba(255,223,0,0.18)]"
                  : "border-white/10 bg-white/5 text-white/90 hover:bg-white/10"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={`w-4 h-4 ${active ? "text-[var(--accent-contrast)]" : "text-white/75"}`} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Right: actions */}
      <div className="flex items-center gap-2 lg:gap-4 relative z-10">
        {/* Mobile menu */}
        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={mobileNavOpen}
          aria-controls={mobileNavId}
          onClick={() => setMobileNavOpen(prev => !prev)}
          className={`${menuButtonHidden ? "hidden" : ""} text-[#adadb8] hover:text-white p-2 rounded-md hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30`}
        >
          {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        {/* Studio link */}
        {showStudioLink && (
          <Link href="/studio" className="hidden sm:inline-flex items-center rounded-md px-3 py-2 text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors">Studio</Link>
        )}
    {/* Wallet balance */}
    {showWalletBalance && <WalletBalance />}
    {/* Wallet */}
    <WalletMultiButton className="!rounded-md !px-3 !py-2 !h-auto !bg-[var(--accent)] hover:!brightness-110 !text-[var(--accent-contrast)] !text-xs !font-medium !border !border-white/10 !shadow" />
      </div>

      {/* Mobile nav overlay */}
      {mobileNavOpen && (
        <>
          <div className="fixed inset-0 z-[30] bg-black/50" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
          <div
            id={mobileNavId}
            className="absolute top-full left-0 right-0 z-[40] border-b border-white/10 bg-[#0E1525]/95 backdrop-blur-xl md:left-auto md:right-0 md:w-80 md:rounded-b-lg md:border md:border-white/10 md:shadow-xl"
          >
            <nav className="flex flex-col gap-2 px-4 py-4">
              {hideStudioLink && (
                <Link
                  href="/studio"
                  className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium bg-white/5 text-white/80 hover:bg-white/10 transition-colors"
                >
                  Studio
                </Link>
              )}
              {hideBalance && (
                <div className="pt-1">
                  <WalletBalance />
                </div>
              )}
              {showNavLinksInDropdown &&
                navLinks.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_0_18px_rgba(255,223,0,0.18)]"
                          : "bg-white/5 text-white/80 hover:bg-white/10"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                    </Link>
                  );
                })}
            </nav>
          </div>
        </>
      )}
    </motion.header>
  );
}

export default TwitchHeader;
