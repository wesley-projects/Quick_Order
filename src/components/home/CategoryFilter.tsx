"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

export default function CategoryFilter({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("category");

  function select(name: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (current === name) {
      params.delete("category");
    } else {
      params.set("category", name);
    }
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => select(cat.name)}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
            current === cat.name
              ? "bg-orange-500 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          )}
        >
          {cat.icon && <span>{cat.icon}</span>}
          {cat.name}
        </button>
      ))}
    </div>
  );
}
