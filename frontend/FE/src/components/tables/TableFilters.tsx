"use client";

import { SearchInput } from "@/components/ui/SearchInput";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function TableFilters({
  searchPlaceholder = "Search…",
  value,
  onChange,
  onFilterClick,
  className,
}: {
  searchPlaceholder?: string;
  value: string;
  onChange: (v: string) => void;
  onFilterClick?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <SearchInput
        placeholder={searchPlaceholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-[220px]"
      />
      {onFilterClick ? (
        <Button variant="ghost" size="sm" type="button" onClick={onFilterClick}>
          Filter
        </Button>
      ) : null}
    </div>
  );
}
