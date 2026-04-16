import axios from "axios";
import * as cheerio from "cheerio";

export interface ScrapedOffer {
  title: string;
  price: number; // em centavos
  originalPrice?: number;
  url: string;
  productId: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  inStock: boolean;
}

const SEARCH_QUERY = "playstation 5 pro";
const BASE_URL = "https://www.amazon.com.br/s";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function parsePrice(priceText: string): number {
  // Amazon usa formato: "R$ 5.999,99"
  const cleaned = priceText.replace(/[^\d,]/g, "").replace(".", "").replace(",", ".");
  const price = parseFloat(cleaned);
  return Math.round(price * 100);
}

export async function scrapeAmazon(): Promise<ScrapedOffer[]> {
  try {
    const searchUrl = `${BASE_URL}?k=${encodeURIComponent(SEARCH_QUERY)}`;

    const response = await axios.get(searchUrl, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "Accept-Encoding": "gzip, deflate",
        DNT: "1",
        Connection: "keep-alive",
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const offers: ScrapedOffer[] = [];

    // Seletor para items de produto na Amazon
    $("div[data-component-type='s-search-result']").each((index, element) => {
      try {
        const $item = $(element);

        const title = $item.find("h2 a span").text().trim();
        const priceText = $item.find("span.a-price-whole").text().trim();
        const url = $item.find("h2 a").attr("href");
        const imageUrl = $item.find("img.s-image").attr("src");
        const productId = $item.attr("data-asin");

        if (!title || !priceText || !url || !productId) {
          return;
        }

        const price = parsePrice(priceText);

        // Verificar se está disponível
        const outOfStock = $item.find(".a-price-tag").text().includes("Indisponível");

        offers.push({
          title,
          price,
          url: url.startsWith("http") ? url : `https://www.amazon.com.br${url}`,
          productId,
          imageUrl,
          inStock: !outOfStock,
        });
      } catch (error) {
        console.error("[Amazon Scraper] Erro ao processar item:", error);
      }
    });

    console.log(`[Amazon Scraper] Encontradas ${offers.length} ofertas`);
    return offers;
  } catch (error) {
    console.error("[Amazon Scraper] Erro ao scraping:", error);
    return [];
  }
}
