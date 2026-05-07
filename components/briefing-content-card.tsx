import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { BriefingAggregateBadge } from "@/components/briefing-status-badge";
import type { BriefingWithStatus } from "@/lib/schemas/briefing";

const MES_PT_LONG = [
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

export function BriefingContentCard({
  briefing,
}: {
  briefing: BriefingWithStatus;
}) {
  const semMes =
    briefing.semana != null && briefing.mes != null
      ? `Sem ${briefing.semana} · ${MES_PT_LONG[briefing.mes - 1]}/${briefing.ano ?? ""}`
      : briefing.mes != null
        ? `${MES_PT_LONG[briefing.mes - 1]}/${briefing.ano ?? ""}`
        : null;

  return (
    <Link
      href={`/dashboard/briefings/${briefing.id}`}
      className="group block rounded-lg border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-foreground/20"
    >
      <div className="flex items-center justify-between">
        <div className="font-mono text-xs text-muted-foreground tracking-wider">
          PAUTA {briefing.briefing_number}
        </div>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider px-1.5 py-0">
          {briefing.source === "docs" ? "Docs" : "Nativa"}
        </Badge>
      </div>

      <h3 className="mt-3 text-base font-semibold leading-snug line-clamp-2 group-hover:text-foreground">
        {briefing.headline?.trim() || briefing.take_inicial?.trim() || "Sem título"}
      </h3>

      {briefing.fala_inicial ? (
        <p className="mt-1.5 text-sm text-muted-foreground line-clamp-1">
          {briefing.fala_inicial}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {briefing.produtos.slice(0, 2).map((p) => (
          <Badge key={p} variant="secondary" className="text-xs">
            {p}
          </Badge>
        ))}
        {briefing.produtos.length > 2 ? (
          <span className="text-xs text-muted-foreground">
            +{briefing.produtos.length - 2}
          </span>
        ) : null}
        {briefing.assignment_count > 0 ? (
          <BriefingAggregateBadge status={briefing.aggregate_status} />
        ) : null}
      </div>

      {semMes ? (
        <div className="mt-3 text-xs text-muted-foreground">{semMes}</div>
      ) : null}
    </Link>
  );
}
