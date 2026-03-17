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

export type SpendShareDataPoint = {
  label: string;
  spend: number;
  sharePercent: number;
};

interface SpendShareChartProps {
  data: SpendShareDataPoint[];
  title: string;
}

const chartConfig = {
  spend: {
    label: "Gasto em Creators (R$)",
    color: "hsl(var(--chart-1))",
  },
  sharePercent: {
    label: "Share %",
    color: "hsl(var(--chart-2))",
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

export function SpendShareChart({ data, title }: SpendShareChartProps) {
  if (data.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium">{title}</h3>
        <div className="flex h-[300px] items-center justify-center rounded-md border text-sm text-muted-foreground">
          Sem dados para o período selecionado
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{title}</h3>
      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <ComposedChart data={data}>
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
                  {payload.map((entry) => (
                    <div
                      key={entry.dataKey}
                      className="flex items-center gap-2"
                    >
                      <div
                        className="h-2.5 w-2.5 rounded-[2px]"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-muted-foreground">
                        {entry.dataKey === "spend"
                          ? "Gasto"
                          : "Share"}
                        :
                      </span>
                      <span className="font-mono font-medium">
                        {entry.dataKey === "spend"
                          ? formatBRL(entry.value as number)
                          : formatPercent(entry.value as number)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            yAxisId="left"
            dataKey="spend"
            fill="var(--color-spend)"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
          <Line
            yAxisId="right"
            dataKey="sharePercent"
            type="monotone"
            stroke="var(--color-sharePercent)"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}
