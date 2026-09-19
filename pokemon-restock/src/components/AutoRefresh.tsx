"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-renders the server component tree on an interval, so a board left open
 * keeps showing current stock without a websocket. Pauses when the tab is
 * hidden — polling a background tab is wasted work on both ends.
 */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setRefreshedAt(new Date());
    };
    const id = setInterval(tick, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-mint-500 animate-pulseRing" />
      live · refreshes every {seconds}s
      {refreshedAt && (
        <span suppressHydrationWarning className="text-slate-600">
          (updated {refreshedAt.toLocaleTimeString()})
        </span>
      )}
    </span>
  );
}
