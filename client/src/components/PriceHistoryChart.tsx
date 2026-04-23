import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function formatPrice(centavos: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);
}

interface Props {
  offerId: number;
  offerTitle: string;
}

export function PriceHistoryChart({ offerId, offerTitle }: Props) {
  const { data, isLoading } = trpc.offers.getPriceHistory.useQuery(offerId);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        Nenhum histórico de preço disponível para esta oferta.
      </p>
    );
  }

  const chartData = data
    .slice()
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .map((entry) => ({
      date: new Date(entry.recordedAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      price: entry.price,
      label: formatPrice(entry.price),
    }));

  const prices = chartData.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const padding = Math.round((maxPrice - minPrice) * 0.1) || 1000;

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground line-clamp-1">{offerTitle}</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[minPrice - padding, maxPrice + padding]}
            tickFormatter={(v) => formatPrice(v)}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip
            formatter={(value: number) => [formatPrice(value), "Preço"]}
            labelStyle={{ fontWeight: 600 }}
            contentStyle={{ fontSize: 12 }}
          />
          <Line
            type="stepAfter"
            dataKey="price"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3, fill: "#10b981" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex justify-between text-xs text-muted-foreground px-1">
        <span>Mínimo: <span className="font-semibold text-green-600">{formatPrice(minPrice)}</span></span>
        <span>Máximo: <span className="font-semibold">{formatPrice(maxPrice)}</span></span>
      </div>
    </div>
  );
}
