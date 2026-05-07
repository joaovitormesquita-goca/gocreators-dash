"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { BriefingFormRow } from "@/components/briefing-form-row";
import { BriefingProductsInput } from "@/components/briefing-products-input";
import {
  createBriefing,
  updateBriefing,
  deleteBriefing,
} from "@/app/dashboard/briefings/actions";
import type { BriefingFormInput, Briefing } from "@/lib/schemas/briefing";

type Brand = { id: number; name: string };

const MES_PT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function buildNamingTemplate(form: BriefingFormInput): string {
  const mes = form.mes ? MES_PT[form.mes - 1] : "<mes>";
  const ano = form.ano ? String(form.ano).slice(-2) : "<aa>";
  const num = form.briefing_number || "<numero>";
  const sem = form.semana || "<semana>";
  const produto = form.produtos[0] || "ProdutoFocoDoVideo";
  return `@<insta> - ${mes} ${ano} - pauta ${num} - semana ${sem} - ${produto} - sem headline/com headline`;
}

export function BriefingForm({
  mode,
  brands,
  initial,
  initialBrandId,
  initialNumber,
}: {
  mode: "create" | "edit";
  brands: Brand[];
  initial?: Briefing;
  initialBrandId?: number;
  initialNumber?: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const [form, setForm] = React.useState<BriefingFormInput>(() => ({
    brand_id: initial?.brand_id ?? initialBrandId ?? brands[0]?.id ?? 0,
    briefing_number:
      initial?.briefing_number ??
      initialNumber ??
      0,
    semana: initial?.semana ?? null,
    mes: initial?.mes ?? new Date().getMonth() + 1,
    ano: initial?.ano ?? new Date().getFullYear(),
    ref_url: initial?.ref_url ?? null,
    take_inicial: initial?.take_inicial ?? null,
    fala_inicial: initial?.fala_inicial ?? null,
    headline: initial?.headline ?? null,
    construcao: initial?.construcao ?? null,
    tempo_video: initial?.tempo_video ?? null,
    produtos: initial?.produtos ?? [],
  }));

  const [dirty, setDirty] = React.useState(false);

  function setField<K extends keyof BriefingFormInput>(
    key: K,
    value: BriefingFormInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  // beforeunload guard
  React.useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function handleSave() {
    if (!form.brand_id || !form.briefing_number) {
      toast.error("Marca e número da pauta são obrigatórios");
      return;
    }
    startTransition(async () => {
      if (mode === "create") {
        const result = await createBriefing(form);
        if (result.success) {
          toast.success("Pauta criada");
          setDirty(false);
          router.push(`/dashboard/briefings/${result.id}`);
        } else {
          toast.error(result.error);
        }
      } else {
        if (!initial?.id) return;
        const result = await updateBriefing({ ...form, id: initial.id });
        if (result.success) {
          toast.success("Pauta atualizada");
          setDirty(false);
          router.refresh();
        } else {
          toast.error(result.error);
        }
      }
    });
  }

  // Cmd+S / Ctrl+S
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, mode]);

  function handleDelete() {
    if (!initial?.id) return;
    if (!confirm(`Deletar pauta ${initial.briefing_number}? Essa ação remove também todas as alocações.`))
      return;
    startTransition(async () => {
      const result = await deleteBriefing({ id: initial.id });
      if (result.success) {
        toast.success("Pauta removida");
        router.push("/dashboard/briefings");
      } else {
        toast.error(result.error);
      }
    });
  }

  const namingTemplate = buildNamingTemplate(form);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/briefings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Briefings
        </Link>
        <div className="flex items-center gap-2">
          {mode === "edit" && initial?.source ? (
            <Badge variant="outline" className="text-xs">
              {initial.source === "docs" ? "Docs" : "Nativa"}
            </Badge>
          ) : null}
          {mode === "edit" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir
            </Button>
          ) : null}
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar (⌘S)"}
          </Button>
        </div>
      </div>

      {mode === "edit" && initial?.source === "docs" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠ Esta pauta foi sincronizada do Google Docs. Edits aqui podem ser sobrescritos no próximo sync.
        </div>
      ) : null}

      <div className="rounded-lg border overflow-hidden">
        <div className="bg-muted/30 px-4 py-4 text-center border-b">
          <div className="font-mono text-xl font-bold tracking-tight">
            PAUTA{" "}
            <input
              type="number"
              value={form.briefing_number || ""}
              onChange={(e) =>
                setField("briefing_number", Number(e.target.value) || 0)
              }
              className="inline-block w-[100px] bg-transparent text-center font-mono text-xl font-bold focus:outline-none focus:ring-1 focus:ring-ring rounded"
              min={1}
            />
          </div>
        </div>

        <BriefingFormRow label="Fala inicial">
          <AutoTextarea
            value={form.fala_inicial ?? ""}
            onChange={(e) => setField("fala_inicial", e.target.value || null)}
            placeholder='"O que você tá fazendo?" "Finalizando..."'
          />
        </BriefingFormRow>

        <BriefingFormRow label="Take inicial">
          <AutoTextarea
            value={form.take_inicial ?? ""}
            onChange={(e) => setField("take_inicial", e.target.value || null)}
            placeholder="Personagem 1 tentando finalizar..."
          />
        </BriefingFormRow>

        <BriefingFormRow label="Headline">
          <AutoTextarea
            value={form.headline ?? ""}
            onChange={(e) => setField("headline", e.target.value || null)}
            placeholder="POV: você acha que sabe..."
            minRows={1}
          />
        </BriefingFormRow>

        <BriefingFormRow label="Construção">
          <AutoTextarea
            value={form.construcao ?? ""}
            onChange={(e) => setField("construcao", e.target.value || null)}
            placeholder="- A ideia é uma espécie de teatrinho..."
            minRows={3}
          />
        </BriefingFormRow>

        <BriefingFormRow label="Referência">
          <Input
            type="url"
            value={form.ref_url ?? ""}
            onChange={(e) => setField("ref_url", e.target.value || null)}
            placeholder="https://..."
            className="border-0 rounded-none focus-visible:ring-1"
          />
        </BriefingFormRow>

        <BriefingFormRow label="Produto">
          <BriefingProductsInput
            value={form.produtos}
            onChange={(next) => setField("produtos", next)}
          />
        </BriefingFormRow>

        <BriefingFormRow label="Tempo de Vídeo">
          <Input
            value={form.tempo_video ?? ""}
            onChange={(e) => setField("tempo_video", e.target.value || null)}
            placeholder="Até 1:00s"
            className="border-0 rounded-none focus-visible:ring-1"
          />
        </BriefingFormRow>

        <BriefingFormRow label="Nomeie o vídeo com" isLast>
          <div className="px-3 py-2 text-sm text-muted-foreground italic font-mono">
            {namingTemplate}
          </div>
        </BriefingFormRow>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Marca
          </label>
          <Select
            value={form.brand_id ? String(form.brand_id) : ""}
            onValueChange={(v) => setField("brand_id", Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Marca" />
            </SelectTrigger>
            <SelectContent>
              {brands.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Semana
          </label>
          <Input
            type="number"
            value={form.semana ?? ""}
            onChange={(e) => setField("semana", e.target.value ? Number(e.target.value) : null)}
            min={1}
            max={53}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Mês
          </label>
          <Input
            type="number"
            value={form.mes ?? ""}
            onChange={(e) => setField("mes", e.target.value ? Number(e.target.value) : null)}
            min={1}
            max={12}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Ano
          </label>
          <Input
            type="number"
            value={form.ano ?? ""}
            onChange={(e) => setField("ano", e.target.value ? Number(e.target.value) : null)}
            min={2020}
            max={2050}
          />
        </div>
      </div>
    </div>
  );
}
