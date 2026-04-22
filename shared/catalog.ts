const ACCESSORY_PATTERN =
  /ventoinha|resfriamento|refrigera[çc]|controle|dualsense|headset|\bfone\b|\bcabo\b|carregador|suporte|\bcapa\b|pel[íi]cula|\bbase\b|\bstand\b|unidade de disco|\bjogo\b|\bgame\b|\bskin\b|protetor|compat[íi]vel|cooler|cooling|\bfan\b|\bfonte\b|adaptador|bateria|\bgrip\b|\bdock\b|\bhub\b|acess[oó]rio|\bcase\b|\btampa\b|limpeza/i;

export interface MatchContext {
  title: string;   // já em lowercase
  price?: number;  // em centavos
}

export interface CatalogItem {
  id: string;
  label: string;
  searchQuery: string;
  isMatch: (ctx: MatchContext) => boolean;
}

// PS5 Pro no Brasil: lançou a ~R$ 5.000, dificilmente < R$ 3.000 ou > R$ 12.000
const PS5_PRO_PRICE_MIN = 300_000;   // R$ 3.000
const PS5_PRO_PRICE_MAX = 1_200_000; // R$ 12.000

export const CATALOG: CatalogItem[] = [
  {
    id: "ps5-pro-console",
    label: "Console PlayStation 5 Pro",
    searchQuery: "console playstation 5 pro",
    isMatch: ({ title, price }) => {
      // Descarte imediato: acessórios e derivados conhecidos
      if (ACCESSORY_PATTERN.test(title)) return false;

      // Excluir explicitamente gerações anteriores (PS1–PS4)
      if (/playstation\s*[1-4]|\bps[1-4]\b/i.test(title)) return false;

      // Deve mencionar a plataforma e a geração "pro"
      const hasPlatform = title.includes("playstation") || title.includes("ps5");
      const hasPro = title.includes("pro");
      if (!hasPlatform || !hasPro) return false;

      // "console" no título é sinal suficiente por si só
      if (title.includes("console")) return true;

      // Sem "console" no título, exige sinais corroborativos
      // Cada sinal indica independentemente que é o hardware físico do PS5 Pro
      const signals: boolean[] = [
        title.includes("sony"),
        title.includes("1tb"),
        title.includes("2tb"),
        title.includes("ssd"),
        title.includes("8k"),
        title.includes("lacrado"),
        title.includes("edição digital") || title.includes("edicao digital") || title.includes("digital edition"),
        /cfi[-\s]?7/i.test(title),  // códigos de modelo: CFI-7000B, CFI-7016…
        price !== undefined && price >= PS5_PRO_PRICE_MIN && price <= PS5_PRO_PRICE_MAX,
      ];

      // Preço na faixa certa já conta como 1 sinal (incluído em `signals` acima).
      // Exige ao menos 2 sinais corroborativos para garantir que é o console físico.
      return signals.filter(Boolean).length >= 2;
    },
  },
];

export const DEFAULT_ITEM_ID = CATALOG[0].id;

export function getCatalogItem(id: string): CatalogItem {
  const item = CATALOG.find((i) => i.id === id);
  if (!item) throw new Error(`Item de catálogo não encontrado: ${id}`);
  return item;
}
