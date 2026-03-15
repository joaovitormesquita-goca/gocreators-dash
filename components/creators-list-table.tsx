"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil } from "lucide-react";
import { EditCreatorDialog } from "@/components/edit-creator-dialog";
import type { CreatorWithBrands } from "@/app/dashboard/creators/list/actions";

type Brand = { id: number; name: string };
type SortKey = "full_name" | "email";
type SortDir = "asc" | "desc";

export function CreatorsListTable({
  creators,
  brands,
}: {
  creators: CreatorWithBrands[];
  brands: Brand[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("full_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editingCreator, setEditingCreator] =
    useState<CreatorWithBrands | null>(null);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    return [...creators].sort((a, b) => {
      const aVal = a[sortKey] ?? "";
      const bVal = b[sortKey] ?? "";
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [creators, sortKey, sortDir]);

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column)
      return <ArrowUpDown className="ml-1 h-3 w-3 inline" />;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 inline" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 inline" />
    );
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none whitespace-nowrap"
                onClick={() => handleSort("full_name")}
              >
                Nome
                <SortIcon column="full_name" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none whitespace-nowrap"
                onClick={() => handleSort("email")}
              >
                Email
                <SortIcon column="email" />
              </TableHead>
              <TableHead className="whitespace-nowrap">Marcas</TableHead>
              <TableHead className="whitespace-nowrap w-[70px]">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                >
                  Nenhum creator cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((creator) => (
                <TableRow key={creator.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {creator.full_name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {creator.email || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {creator.brands.length === 0 ? (
                        <span className="text-muted-foreground text-sm">
                          -
                        </span>
                      ) : (
                        creator.brands.map((brand) => (
                          <Badge key={brand.assignmentId} variant="secondary">
                            {brand.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingCreator(creator)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editingCreator && (
        <EditCreatorDialog
          creator={editingCreator}
          brands={brands}
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditingCreator(null);
          }}
        />
      )}
    </>
  );
}
