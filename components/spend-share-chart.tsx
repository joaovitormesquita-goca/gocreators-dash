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
  goal?: number;
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
  goal: {
    label: "Meta",
    color: "#ef4444",
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
  const hasGoal = data.some((d) => d.goal !== undefined);
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
                  {payload.map((entry) => {
                    if (entry.dataKey === "goal" && entry.value == null) return null;
                    const entryLabel =
                      entry.dataKey === "spend"
                        ? "Gasto"
                        : entry.dataKey === "goal"
                          ? "Meta"
                          : "Share";
                    const formatted =
                      entry.dataKey === "spend"
                        ? formatBRL(entry.value as number)
                        : formatPercent(entry.value as number);
                    return (
                      <div
                        key={entry.dataKey}
                        className="flex items-center gap-2"
                      >
                        <div
                          className="h-2.5 w-2.5 rounded-[2px]"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-muted-foreground">
                          {entryLabel}:
                        </span>
                        <span className="font-mono font-medium">
                          {formatted}
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
          {hasGoal && (
            <Line
              yAxisId="right"
              dataKey="goal"
              type="monotone"
              stroke="var(--color-goal)"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={false}
              connectNulls={false}
            />
          )}
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}
