"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BookText, Gauge, LineChart, Rocket } from "lucide-react";
import { cn } from "@/lib/cn";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: Activity },
  { href: "/recipes", label: "Recipes", icon: BookText },
  { href: "/launch", label: "Launch", icon: Rocket },
  { href: "/benchmarks", label: "Benchmarks", icon: Gauge },
  { href: "/monitor", label: "Monitor", icon: LineChart },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 " +
                    "dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
            )}
          >
            <Icon size={16} strokeWidth={2} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
