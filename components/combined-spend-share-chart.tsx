"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";

export type CombinedSpendShareDataPoint = {
  label: string;
  spendTotal: number;
  spendRecentes: number;
  sharePercentTotal: number;
  sharePercentRecentes: number;
};

interface CombinedSpendShareChartProps {
  data: CombinedSpendShareDataPoint[];
  title: string;
}

const chartConfig = {
  spendTotal: {
    label: "Gasto Total (R$)",
    color: "hsl(var(--chart-1))",
  },
  spendRecentes: {
    label: "Gasto Recentes (R$)",
    color: "hsl(var(--chart-3))",
  },
  sharePercentTotal: {
    label: "Share Total %",
    color: "hsl(var(--chart-2))",
  },
  sharePercentRecentes: {
    label: "Share Recentes %",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig;

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

const tooltipLabels: Record<string, string> = {
  spendTotal: "Gasto Total",
  spendRecentes: "Gasto Recentes",
  sharePercentTotal: "Share Total",
  sharePercentRecentes: "Share Recentes",
};

export function CombinedSpendShareChart({
  data,
  title,
}: CombinedSpendShareChartProps) {
  if (data.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium">{title}</h3>
        <div className="flex h-[380px] items-center justify-center rounded-md border text-sm text-muted-foreground">
          Sem dados para o período selecionado
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{title}</h3>
      <ChartContainer config={chartConfig} className="h-[380px] w-full">
        <ComposedChart data={data} barGap={2} barCategoryGap="20%">
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={12}
          />
          <YAxis
            yAxisId="left"
            tickLine={false}
            axisLine={false}
            tickFormatter={formatBRL}
            fontSize={12}
            width={80}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tickFormatter={formatPercent}
            fontSize={12}
            width={50}
            domain={[0, "auto"]}
          />
          <ChartTooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-lg border bg-background p-2.5 text-xs shadow-xl">
                  <p className="mb-1.5 font-medium">{label}</p>
                  {payload.map((entry) => {
                    const key = entry.dataKey as string;
                    const isPercent = key.startsWith("sharePercent");
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-2"
                      >
                        <div
                          className="h-2.5 w-2.5 rounded-[2px]"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-muted-foreground">
                          {tooltipLabels[key] ?? key}:
                        </span>
                        <span className="font-mono font-medium">
                          {isPercent
                            ? formatPercent(entry.value as number)
                            : formatBRL(entry.value as number)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            yAxisId="left"
            dataKey="spendTotal"
            fill="var(--color-spendTotal)"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
          <Bar
            yAxisId="left"
            dataKey="spendRecentes"
            fill="var(--color-spendRecentes)"
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
          <Line
            yAxisId="right"
            dataKey="sharePercentTotal"
            type="monotone"
            stroke="var(--color-sharePercentTotal)"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="right"
            dataKey="sharePercentRecentes"
            type="monotone"
            stroke="var(--color-sharePercentRecentes)"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}
