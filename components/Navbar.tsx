'use client';

import Link from "next/link";
import WalletConnectButton from "./WalletConnectButton";
import { ThemeToggle } from "./ThemeToggle";
import { useWallet } from "../contexts";

function truncateAddress(address: string) {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function Navbar() {
  const { connected, isRestoring, publicKey } = useWallet();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-dark-900/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-white">
          <span className="text-brand-400">&#x2B21;</span> NeuroWealth
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          <Link href="#features" className="hover:text-white transition-colors">Features</Link>
          <Link href="#how-it-works" className="hover:text-white transition-colors">How it works</Link>
          <Link href="#strategies" className="hover:text-white transition-colors">Strategies</Link>
          <Link href="/help" className="hover:text-white transition-colors">Help</Link>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/help" className="md:hidden text-sm text-slate-400 hover:text-white transition-colors">
            Help
          </Link>

          {!isRestoring && connected && publicKey ? (
            <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-mono text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {truncateAddress(publicKey)}
            </span>
          ) : null}

          <WalletConnectButton />
        </div>
      </div>
    </nav>
  );
}
