"use client";

import type { Table as TanTable } from "@tanstack/react-table";
import { Button } from "@/components/ui/Button";

export function TablePagination<T>({ table }: { table: TanTable<T> }) {
  const page = table.getState().pagination.pageIndex + 1;
  const pageCount = table.getPageCount();
  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-end gap-2 border-t border-line bg-card px-4 py-3">
      <Button
        variant="ghost"
        size="sm"
        type="button"
        disabled={!table.getCanPreviousPage()}
        onClick={() => table.previousPage()}
      >
        Previous
      </Button>
      <span className="text-sm text-mid">
        {page} / {pageCount}
      </span>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        disabled={!table.getCanNextPage()}
        onClick={() => table.nextPage()}
      >
        Next
      </Button>
    </div>
  );
}
