import Link from "next/link";
import Image from "next/image";
import { Nav } from "./Nav";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div id="root-isolation" className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100"
          >
            <Image src="/logo.svg" alt="" width={20} height={20} priority />
            sparkrun
          </Link>
          <Nav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
