import axios from "axios";

export interface ScrapedOffer {
  title: string;
  price: number;
  originalPrice?: number;
  url: string;
  productId: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  inStock: boolean;
}

const SEARCH_QUERY = "playstation 5 pro";
const BASE_URL = "https://www.magazineluiza.com.br/busca";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function parsePrice(priceText: string): number {
  const cleaned = priceText.replace(/[^\d,]/g, "").replace(",", ".");
  const price = parseFloat(cleaned);
  return Math.round(price * 100);
}

export async function scrapeMagazineLuiza(): Promise<ScrapedOffer[]> {
  try {
    // Magazine Luiza usa API GraphQL, vamos tentar uma abordagem alternativa
    const searchUrl = `${BASE_URL}/${encodeURIComponent(SEARCH_QUERY)}`;

    const response = await axios.get(searchUrl, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      timeout: 10000,
    });

    // Magazine Luiza carrega conteúdo com JavaScript, então o scraping HTML é limitado
    // Retorna array vazio por enquanto - seria necessário usar Puppeteer
    console.log("[Magazine Luiza Scraper] Requer JavaScript rendering - usar Puppeteer");
    return [];
  } catch (error) {
    console.error("[Magazine Luiza Scraper] Erro ao scraping:", error);
    return [];
  }
}
