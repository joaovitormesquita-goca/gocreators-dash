"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil } from "lucide-react";
import { EditCreatorDialog } from "@/components/edit-creator-dialog";
import {
  getGroupsByBrand,
  bulkUpdateCreatorBrandGroup,
  type GroupOption,
} from "@/app/dashboard/creators/list/actions";
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
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("full_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedBrandId, setSelectedBrandId] = useState<string>("all");
  const [editingCreator, setEditingCreator] =
    useState<CreatorWithBrands | null>(null);

  // Bulk assign state
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkGroupId, setBulkGroupId] = useState<string>("");
  const [isBulkPending, startBulkTransition] = useTransition();

  useEffect(() => {
    setSelectedIds(new Set());
    setBulkGroupId("");
    if (selectedBrandId !== "all") {
      getGroupsByBrand(Number(selectedBrandId)).then(setGroups);
    } else {
      setGroups([]);
    }
  }, [selectedBrandId]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function getAssignmentId(creator: CreatorWithBrands): number | null {
    if (selectedBrandId === "all") return null;
    const brand = creator.brands.find((b) => b.id === Number(selectedBrandId));
    return brand?.assignmentId ?? null;
  }

  function toggleSelect(assignmentId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(assignmentId)) next.delete(assignmentId);
      else next.add(assignmentId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
    } else {
      const allIds = new Set<number>();
      sorted.forEach((c) => {
        const aid = getAssignmentId(c);
        if (aid) allIds.add(aid);
      });
      setSelectedIds(allIds);
    }
  }

  function handleBulkAssign() {
    if (selectedIds.size === 0) return;
    startBulkTransition(async () => {
      const groupId = bulkGroupId === "none" ? null : Number(bulkGroupId);
      const result = await bulkUpdateCreatorBrandGroup({
        creatorBrandIds: Array.from(selectedIds),
        groupId,
      });
      if (result.success) {
        toast.success(`Grupo atribuído a ${result.count} creator(s)!`);
        setSelectedIds(new Set());
        setBulkGroupId("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const sorted = useMemo(() => {
    const filtered =
      selectedBrandId === "all"
        ? creators
        : creators.filter((c) =>
            c.brands.some((b) => b.id === Number(selectedBrandId))
          );
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey] ?? "";
      const bVal = b[sortKey] ?? "";
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [creators, sortKey, sortDir, selectedBrandId]);

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
      <div className="flex items-center gap-2">
        <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por marca" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as marcas</SelectItem>
            {brands.map((brand) => (
              <SelectItem key={brand.id} value={String(brand.id)}>
                {brand.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedBrandId !== "all" && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/50 p-3">
          <span className="text-sm font-medium">
            {selectedIds.size} creator{selectedIds.size !== 1 ? "s" : ""} selecionado{selectedIds.size !== 1 ? "s" : ""}
          </span>
          <Select value={bulkGroupId} onValueChange={setBulkGroupId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione grupo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem grupo</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id.toString()}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleBulkAssign}
            disabled={!bulkGroupId || isBulkPending}
          >
            {isBulkPending ? "Atribuindo..." : "Atribuir grupo"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            Limpar seleção
          </Button>
        </div>
      )}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {selectedBrandId !== "all" && (
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={sorted.length > 0 && selectedIds.size === sorted.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
              )}
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
              {selectedBrandId !== "all" && (
                <TableHead className="whitespace-nowrap">Grupo</TableHead>
              )}
              <TableHead className="whitespace-nowrap w-[70px]">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={selectedBrandId !== "all" ? 6 : 4}
                  className="text-center text-muted-foreground py-8"
                >
                  Nenhum creator cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((creator) => {
                const assignmentId = getAssignmentId(creator);
                const brandForGroup = selectedBrandId !== "all"
                  ? creator.brands.find((b) => b.id === Number(selectedBrandId))
                  : null;
                const groupName = brandForGroup?.group_id
                  ? groups.find((g) => g.id === brandForGroup.group_id)?.name
                  : null;

                return (
                  <TableRow key={creator.id}>
                    {selectedBrandId !== "all" && (
                      <TableCell>
                        <Checkbox
                          checked={assignmentId ? selectedIds.has(assignmentId) : false}
                          onCheckedChange={() => assignmentId && toggleSelect(assignmentId)}
                        />
                      </TableCell>
                    )}
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
                    {selectedBrandId !== "all" && (
                      <TableCell className="whitespace-nowrap">
                        {groupName ? (
                          <Badge variant="outline">{groupName}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                    )}
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
                );
              })
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
