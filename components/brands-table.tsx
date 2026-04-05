"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  History,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { EditBrandDialog } from "@/components/edit-brand-dialog";
import { EditAdAccountDialog } from "@/components/edit-ad-account-dialog";
import { CreateAdAccountDialog } from "@/components/create-ad-account-dialog";
import { CreateGroupDialog } from "@/components/create-group-dialog";
import { EditGroupDialog } from "@/components/edit-group-dialog";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { BackfillDialog } from "@/components/backfill-dialog";
import {
  deleteBrand,
  deleteAdAccount,
  deleteGroup,
} from "@/app/dashboard/brands/actions";
import type {
  BrandWithAdAccounts,
  AdAccount,
  CreatorGroup,
} from "@/app/dashboard/brands/actions";

type SortDir = "asc" | "desc";

export function BrandsTable({ brands }: { brands: BrandWithAdAccounts[] }) {
  const router = useRouter();
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedBrandId, setExpandedBrandId] = useState<number | null>(null);

  // Edit state
  const [editingBrand, setEditingBrand] = useState<BrandWithAdAccounts | null>(null);
  const [editingAdAccount, setEditingAdAccount] = useState<AdAccount | null>(null);

  // Delete state
  const [deletingBrand, setDeletingBrand] = useState<BrandWithAdAccounts | null>(null);
  const [deletingAdAccount, setDeletingAdAccount] = useState<AdAccount | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  // Group state
  const [editingGroup, setEditingGroup] = useState<CreatorGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<CreatorGroup | null>(null);

  // Backfill state
  const [backfillAdAccount, setBackfillAdAccount] = useState<AdAccount | null>(null);

  function handleSort() {
    setSortDir(sortDir === "asc" ? "desc" : "asc");
  }

  const sorted = useMemo(() => {
    return [...brands].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [brands, sortDir]);

  function toggleExpand(brandId: number) {
    setExpandedBrandId(expandedBrandId === brandId ? null : brandId);
  }

  function handleDeleteBrand() {
    if (!deletingBrand) return;
    startDeleteTransition(async () => {
      const result = await deleteBrand(deletingBrand.id);
      if (result.success) {
        toast.success("Marca excluída com sucesso!");
        setDeletingBrand(null);
        if (expandedBrandId === deletingBrand.id) setExpandedBrandId(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDeleteGroup() {
    if (!deletingGroup) return;
    startDeleteTransition(async () => {
      const result = await deleteGroup(deletingGroup.id);
      if (result.success) {
        toast.success("Grupo excluído com sucesso!");
        setDeletingGroup(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDeleteAdAccount() {
    if (!deletingAdAccount) return;
    startDeleteTransition(async () => {
      const result = await deleteAdAccount(deletingAdAccount.id);
      if (result.success) {
        toast.success("Conta de anúncio excluída com sucesso!");
        setDeletingAdAccount(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead
                className="cursor-pointer select-none whitespace-nowrap"
                onClick={handleSort}
              >
                Nome
                {sortDir === "asc" ? (
                  <ArrowUp className="ml-1 h-3 w-3 inline" />
                ) : sortDir === "desc" ? (
                  <ArrowDown className="ml-1 h-3 w-3 inline" />
                ) : (
                  <ArrowUpDown className="ml-1 h-3 w-3 inline" />
                )}
              </TableHead>
              <TableHead className="whitespace-nowrap">Contas de Anúncio</TableHead>
              <TableHead className="whitespace-nowrap w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                >
                  Nenhuma marca cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((brand) => {
                const isExpanded = expandedBrandId === brand.id;
                return (
                  <BrandRow
                    key={brand.id}
                    brand={brand}
                    isExpanded={isExpanded}
                    onToggleExpand={() => toggleExpand(brand.id)}
                    onEdit={() => setEditingBrand(brand)}
                    onDelete={() => setDeletingBrand(brand)}
                    onEditAdAccount={setEditingAdAccount}
                    onDeleteAdAccount={setDeletingAdAccount}
                    onBackfillAdAccount={setBackfillAdAccount}
                    onEditGroup={setEditingGroup}
                    onDeleteGroup={setDeletingGroup}
                  />
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Brand Dialog */}
      {editingBrand && (
        <EditBrandDialog
          brand={editingBrand}
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditingBrand(null);
          }}
        />
      )}

      {/* Edit Ad Account Dialog */}
      {editingAdAccount && (
        <EditAdAccountDialog
          adAccount={editingAdAccount}
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditingAdAccount(null);
          }}
        />
      )}

      {/* Delete Brand Confirmation */}
      <DeleteConfirmDialog
        open={deletingBrand !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingBrand(null);
        }}
        title="Excluir marca"
        description={
          deletingBrand
            ? deletingBrand.ad_accounts.length > 0
              ? `Esta ação irá excluir a marca "${deletingBrand.name}" e todas as ${deletingBrand.ad_accounts.length} conta(s) de anúncio vinculadas. Esta ação não pode ser desfeita.`
              : `Esta ação irá excluir a marca "${deletingBrand.name}". Esta ação não pode ser desfeita.`
            : ""
        }
        onConfirm={handleDeleteBrand}
        loading={isDeleting}
      />

      {/* Delete Ad Account Confirmation */}
      <DeleteConfirmDialog
        open={deletingAdAccount !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingAdAccount(null);
        }}
        title="Excluir conta de anúncio"
        description={
          deletingAdAccount
            ? `Esta ação irá excluir a conta "${deletingAdAccount.name}" (${deletingAdAccount.meta_account_id}). Esta ação não pode ser desfeita.`
            : ""
        }
        onConfirm={handleDeleteAdAccount}
        loading={isDeleting}
      />

      {/* Backfill Dialog */}
      {backfillAdAccount && (
        <BackfillDialog
          adAccountId={backfillAdAccount.id}
          adAccountName={backfillAdAccount.name}
          open={true}
          onOpenChange={(open) => {
            if (!open) setBackfillAdAccount(null);
          }}
        />
      )}

      {/* Edit Group Dialog */}
      {editingGroup && (
        <EditGroupDialog
          group={editingGroup}
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditingGroup(null);
          }}
        />
      )}

      {/* Delete Group Confirmation */}
      <DeleteConfirmDialog
        open={deletingGroup !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingGroup(null);
        }}
        title="Excluir grupo"
        description={
          deletingGroup
            ? `Esta ação irá excluir o grupo "${deletingGroup.name}". Esta ação não pode ser desfeita.`
            : ""
        }
        onConfirm={handleDeleteGroup}
        loading={isDeleting}
      />
    </>
  );
}

function BrandRow({
  brand,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onEditAdAccount,
  onDeleteAdAccount,
  onBackfillAdAccount,
  onEditGroup,
  onDeleteGroup,
}: {
  brand: BrandWithAdAccounts;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onEditAdAccount: (aa: AdAccount) => void;
  onDeleteAdAccount: (aa: AdAccount) => void;
  onBackfillAdAccount: (aa: AdAccount) => void;
  onEditGroup: (g: CreatorGroup) => void;
  onDeleteGroup: (g: CreatorGroup) => void;
}) {
  return (
    <>
      <TableRow className="hover:bg-muted/50">
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onToggleExpand}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>
        <TableCell className="whitespace-nowrap font-medium">
          {brand.name}
        </TableCell>
        <TableCell>
          <Badge variant="secondary">
            {brand.ad_accounts.length} conta{brand.ad_accounts.length !== 1 ? "s" : ""}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow>
          <TableCell colSpan={4} className="bg-muted/30 p-4">
            <div className="space-y-6">
              {/* Ad Accounts Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Contas de Anúncio
                  </h4>
                  <CreateAdAccountDialog brandId={brand.id} />
                </div>

                {brand.ad_accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2 text-center border border-dashed rounded-md">
                    Nenhuma conta de anúncio vinculada.
                  </p>
                ) : (
                  <div className="rounded-md border bg-background">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Nome</TableHead>
                          <TableHead className="whitespace-nowrap">Meta Account ID</TableHead>
                          <TableHead className="whitespace-nowrap w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {brand.ad_accounts.map((aa) => (
                          <TableRow key={aa.id}>
                            <TableCell className="whitespace-nowrap">
                              {aa.name}
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-mono text-sm">
                              {aa.meta_account_id}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onBackfillAdAccount(aa)}
                                  title="Importar historico"
                                >
                                  <History className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onEditAdAccount(aa)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onDeleteAdAccount(aa)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Groups Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    Grupos de Creators
                  </h4>
                  <CreateGroupDialog brandId={brand.id} />
                </div>

                {brand.groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2 text-center border border-dashed rounded-md">
                    Nenhum grupo cadastrado.
                  </p>
                ) : (
                  <div className="rounded-md border bg-background">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Nome</TableHead>
                          <TableHead className="whitespace-nowrap w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {brand.groups.map((g) => (
                          <TableRow key={g.id}>
                            <TableCell className="whitespace-nowrap">
                              {g.name}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onEditGroup(g)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onDeleteGroup(g)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
