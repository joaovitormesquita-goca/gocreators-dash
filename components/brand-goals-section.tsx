"use client";

import { useState, useEffect, useTransition } from "react";
import { format, startOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import {
  getBrandGoals,
  upsertBrandGoal,
  deleteBrandGoal,
  type BrandGoal,
} from "@/app/dashboard/brands/actions";

type Brand = { id: number; name: string };

function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  const start = subMonths(startOfMonth(now), 6);

  for (let i = 0; i < 15; i++) {
    const date = addMonths(start, i);
    options.push({
      value: format(date, "yyyy-MM-01"),
      label: format(date, "MMMM yyyy", { locale: ptBR }),
    });
  }
  return options;
}

const metricOptions = [
  { value: "share_total", label: "Share Total" },
  { value: "share_recent", label: "Share Recente" },
] as const;

export function BrandGoalsSection({ brands }: { brands: Brand[] }) {
  const [isPending, startTransition] = useTransition();
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedMetric, setSelectedMetric] = useState<string>("");
  const [goalValue, setGoalValue] = useState<string>("");
  const [goals, setGoals] = useState<BrandGoal[]>([]);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<BrandGoal | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const monthOptions = generateMonthOptions();

  useEffect(() => {
    if (selectedBrandId) {
      getBrandGoals(selectedBrandId).then(setGoals).catch(() => {
        toast.error("Erro ao carregar metas");
        setGoals([]);
      });
    } else {
      setGoals([]);
    }
  }, [selectedBrandId]);

  // Auto-load existing goal when brand + month + metric are selected
  useEffect(() => {
    if (!selectedBrandId || !selectedMonth || !selectedMetric) return;

    const existing = goals.find(
      (g) => g.month === selectedMonth && g.metric === selectedMetric,
    );

    if (existing) {
      setGoalValue(String(existing.value));
      setEditingGoalId(existing.id);
    } else {
      setGoalValue("");
      setEditingGoalId(null);
    }
  }, [selectedBrandId, selectedMonth, selectedMetric, goals]);

  function handleBrandChange(value: string) {
    const brandId = Number(value);
    setSelectedBrandId(brandId);
    setSelectedMonth("");
    setSelectedMetric("");
    setGoalValue("");
    setEditingGoalId(null);
  }

  function handleSave() {
    if (!selectedBrandId || !selectedMonth || !selectedMetric || !goalValue) return;

    const numericValue = parseFloat(goalValue);
    if (isNaN(numericValue)) {
      toast.error("Valor inválido");
      return;
    }

    startTransition(async () => {
      const result = await upsertBrandGoal({
        brandId: selectedBrandId,
        metric: selectedMetric as "share_total" | "share_recent",
        month: selectedMonth,
        value: numericValue,
      });

      if (result.success) {
        toast.success(editingGoalId ? "Meta atualizada!" : "Meta salva!");
        const updatedGoals = await getBrandGoals(selectedBrandId);
        setGoals(updatedGoals);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleEdit(goal: BrandGoal) {
    setSelectedMonth(goal.month);
    setSelectedMetric(goal.metric);
    setGoalValue(String(goal.value));
    setEditingGoalId(goal.id);
  }

  function handleDelete() {
    if (!deletingGoal || !selectedBrandId) return;

    startDeleteTransition(async () => {
      const result = await deleteBrandGoal({ goalId: deletingGoal.id });
      if (result.success) {
        toast.success("Meta excluída!");
        setDeletingGoal(null);
        const updatedGoals = await getBrandGoals(selectedBrandId);
        setGoals(updatedGoals);
        if (editingGoalId === deletingGoal.id) {
          setGoalValue("");
          setEditingGoalId(null);
        }
      } else {
        toast.error(result.error);
      }
    });
  }

  function formatMonth(dateStr: string): string {
    const date = new Date(dateStr + "T00:00:00");
    return format(date, "MMM/yyyy", { locale: ptBR });
  }

  function formatMetricLabel(metric: string): string {
    return metric === "share_total" ? "Share Total" : "Share Recente";
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Metas</h2>

      {/* Form row */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Marca
          </Label>
          <Select
            value={selectedBrandId?.toString() ?? ""}
            onValueChange={handleBrandChange}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id.toString()}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Mês
          </Label>
          <Select
            value={selectedMonth}
            onValueChange={setSelectedMonth}
            disabled={!selectedBrandId}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Métrica
          </Label>
          <Select
            value={selectedMetric}
            onValueChange={setSelectedMetric}
            disabled={!selectedBrandId}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {metricOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Meta (%)
          </Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="100"
            placeholder="0.0"
            className="w-[100px]"
            value={goalValue}
            onChange={(e) => setGoalValue(e.target.value)}
            disabled={!selectedBrandId || !selectedMonth || !selectedMetric}
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={
            isPending ||
            !selectedBrandId ||
            !selectedMonth ||
            !selectedMetric ||
            !goalValue
          }
        >
          {isPending
            ? "Salvando..."
            : editingGoalId
              ? "Atualizar"
              : "Salvar"}
        </Button>
      </div>

      {/* Summary table */}
      {selectedBrandId && goals.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Métrica</TableHead>
                <TableHead>Meta</TableHead>
                <TableHead className="w-[80px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goals.map((goal) => (
                <TableRow key={goal.id}>
                  <TableCell>{formatMonth(goal.month)}</TableCell>
                  <TableCell>{formatMetricLabel(goal.metric)}</TableCell>
                  <TableCell className="font-mono">{goal.value}%</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(goal)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingGoal(goal)}
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

      {selectedBrandId && goals.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
          Nenhuma meta cadastrada para esta marca.
        </p>
      )}

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={deletingGoal !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingGoal(null);
        }}
        title="Excluir meta"
        description={
          deletingGoal
            ? `Excluir a meta de ${formatMetricLabel(deletingGoal.metric)} para ${formatMonth(deletingGoal.month)}? Esta ação não pode ser desfeita.`
            : ""
        }
        onConfirm={handleDelete}
        loading={isDeleting}
      />
    </div>
  );
}
