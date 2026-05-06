"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { BriefingAggregateBadge } from "@/components/briefing-status-badge";
import { BriefingAssignmentRow } from "@/components/briefing-assignment-row";
import { BriefingAllocationForm } from "@/components/briefing-allocation-form";
import {
  getBriefingDetail,
  getAllocatableCreators,
} from "@/app/dashboard/briefings/actions";
import type {
  BriefingAssignmentWithCreator,
  BriefingWithStatus,
} from "@/lib/schemas/briefing";

type DetailData = {
  briefing: BriefingWithStatus;
  assignments: BriefingAssignmentWithCreator[];
} | null;

export function BriefingDetailSheet({
  briefingId,
  brandId,
  onOpenChange,
}: {
  briefingId: number | null;
  brandId: number | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [data, setData] = useState<DetailData>(null);
  const [creators, setCreators] = useState<
    { creatorId: number; creatorName: string }[]
  >([]);
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  const open = briefingId != null;

  useEffect(() => {
    if (!open || !briefingId) {
      setData(null);
      return;
    }
    setLoading(true);
    Promise.all([
      getBriefingDetail(briefingId),
      brandId ? getAllocatableCreators(brandId) : Promise.resolve([]),
    ])
      .then(([detail, allocatable]) => {
        setData(detail);
        setCreators(allocatable);
      })
      .finally(() => setLoading(false));
  }, [open, briefingId, brandId]);

  function refresh() {
    if (!briefingId) return;
    startTransition(async () => {
      const detail = await getBriefingDetail(briefingId);
      setData(detail);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {data ? `Pauta ${data.briefing.briefing_number}` : "Pauta"}
          </SheetTitle>
          <SheetDescription>
            {data ? (
              <span className="flex items-center gap-2">
                <BriefingAggregateBadge status={data.briefing.aggregate_status} />
                <span className="text-sm text-muted-foreground">
                  {data.briefing.completed_count}/{data.briefing.assignment_count} entregues
                </span>
              </span>
            ) : (
              "Carregando..."
            )}
          </SheetDescription>
        </SheetHeader>

        {loading || !data ? (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <DetailSection label="Take inicial" value={data.briefing.take_inicial} />
            <DetailSection label="Fala inicial" value={data.briefing.fala_inicial} />
            <DetailSection label="Conceito" value={data.briefing.conceito} />
            <DetailSection
              label="Produtos"
              value={data.briefing.produtos.join(", ") || null}
            />
            {data.briefing.ref_url ? (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Referência
                </div>
                <a
                  href={data.briefing.ref_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 hover:underline break-all"
                >
                  {data.briefing.ref_url}
                </a>
              </div>
            ) : null}

            <Separator />

            <div>
              <h3 className="text-sm font-semibold mb-3">Alocações</h3>
              {data.assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma creator alocada ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.assignments.map((a) => (
                    <BriefingAssignmentRow
                      key={a.id}
                      assignment={a}
                      onChange={refresh}
                    />
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <BriefingAllocationForm
              briefingId={data.briefing.id}
              creators={creators}
              alreadyAllocatedCreatorIds={new Set(
                data.assignments.map((a) => a.creator_id),
              )}
              onSuccess={refresh}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailSection({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
      <div className="text-sm whitespace-pre-wrap">{value || "—"}</div>
    </div>
  );
}
