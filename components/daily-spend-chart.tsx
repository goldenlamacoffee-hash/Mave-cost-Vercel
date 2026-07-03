"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartConfig = {
  v0Cost: { label: "v0", color: "var(--chart-1)" },
  vercelCost: { label: "Vercel", color: "var(--chart-2)" },
} satisfies ChartConfig

export function DailySpendChart({
  data,
}: {
  data: { day: string; v0Cost: number; vercelCost: number }[]
}) {
  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: string) => {
            const d = new Date(value)
            return `${d.getMonth() + 1}/${d.getDate()}`
          }}
          fontSize={11}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) => `$${value.toFixed(0)}`}
          fontSize={11}
          width={44}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="v0Cost" stackId="a" fill="var(--color-v0Cost)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="vercelCost" stackId="a" fill="var(--color-vercelCost)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
