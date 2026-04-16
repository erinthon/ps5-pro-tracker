import axios from "axios";
import * as cheerio from "cheerio";

export interface ScrapedOffer {
  title: string;
  price: number; // em centavos
  originalPrice?: number;
  url: string;
  productId: string;
  imageUrl?: string;
  rating?: number; // em centésimos (ex: 450 = 4.50)
  reviewCount?: number;
  inStock: boolean;
}

const SEARCH_QUERY = "playstation 5 pro";
const BASE_URL = "https://lista.mercadolivre.com.br";

// User agents para rotação
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function parsePrice(priceText: string): number {
  // Remove "R$", espaços e converte para centavos
  const cleaned = priceText.replace(/[^\d,]/g, "").replace(",", ".");
  const price = parseFloat(cleaned);
  return Math.round(price * 100); // Converter para centavos
}

function parseRating(ratingText: string): number | undefined {
  const match = ratingText.match(/(\d+),(\d+)/);
  if (match) {
    return parseInt(match[1] + match[2]); // ex: "4,5" -> 450
  }
  return undefined;
}

export async function scrapeMercadoLivre(): Promise<ScrapedOffer[]> {
  try {
    const searchUrl = `${BASE_URL}/${SEARCH_QUERY}`;

    const response = await axios.get(searchUrl, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "Accept-Encoding": "gzip, deflate",
        DNT: "1",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const offers: ScrapedOffer[] = [];

    // Seletor para items de produto no Mercado Livre
    $("div.poly-component__title").each((index, element) => {
      try {
        const $item = $(element).closest("div[data-item-id]");

        if ($item.length === 0) return;

        const title = $item.find("h2.poly-component__title").text().trim();
        const priceText = $item.find("span.poly-price__current-price").text().trim();
        const originalPriceText = $item.find("span.poly-price__original-price").text().trim();
        const url = $item.find("a.poly-component__title-link").attr("href");
        const imageUrl = $item.find("img.poly-component__picture").attr("src");
        const productId = $item.attr("data-item-id");

        if (!title || !priceText || !url || !productId) {
          return;
        }

        const price = parsePrice(priceText);
        const originalPrice = originalPriceText ? parsePrice(originalPriceText) : undefined;

        // Verificar se está em estoque (geralmente tem um badge "Fora de estoque")
        const outOfStock = $item.find(".poly-component__out-of-stock").length > 0;

        offers.push({
          title,
          price,
          originalPrice,
          url: url.split("?")[0], // Remove query params
          productId,
          imageUrl,
          inStock: !outOfStock,
        });
      } catch (error) {
        console.error("[MercadoLivre Scraper] Erro ao processar item:", error);
      }
    });

    console.log(`[MercadoLivre Scraper] Encontradas ${offers.length} ofertas`);
    return offers;
  } catch (error) {
    console.error("[MercadoLivre Scraper] Erro ao scraping:", error);
    return [];
  }
}
