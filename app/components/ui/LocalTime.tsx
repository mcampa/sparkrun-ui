"use client";
import { useSyncExternalStore } from "react";

/**
 * Render an ISO timestamp without tripping React's hydration check.
 *
 * `toLocaleString()` produces different output on the server (UTC) and the
 * client (browser locale + timezone). To keep SSR markup and the first client
 * render byte-identical we emit the raw ISO string on initial render and
 * upgrade to the localized form once mounted.
 */
const noopSubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function useIsClient(): boolean {
  return useSyncExternalStore(noopSubscribe, getClientSnapshot, getServerSnapshot);
}

function formatIso(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function LocalTime({ iso }: { iso: string | null | undefined }) {
  const isClient = useIsClient();
  if (!iso) return <>—</>;
  return <>{isClient ? formatIso(iso) : iso}</>;
}
