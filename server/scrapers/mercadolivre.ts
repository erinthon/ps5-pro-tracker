import axios from "axios";
import * as cheerio from "cheerio";
import { isPS5ProConsole } from "./filters";

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

const SEARCH_URL = "https://lista.mercadolivre.com.br/console-playstation-5-pro";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function parsePriceParts(fraction: string, cents?: string): number {
  const intPart = parseInt(fraction.replace(/\D/g, ""), 10) || 0;
  const centPart = parseInt((cents ?? "").replace(/\D/g, "").padEnd(2, "0").slice(0, 2), 10) || 0;
  return intPart * 100 + centPart;
}

function extractProductId(href: string): string {
  const widMatch = href.match(/[#&?]wid=([^&]+)/);
  if (widMatch) return widMatch[1];
  const pidMatch = href.match(/\/p\/(MLB\d+)/);
  if (pidMatch) return pidMatch[1];
  return href.split("/").filter(Boolean).pop() ?? "";
}

export async function scrapeMercadoLivre(): Promise<ScrapedOffer[]> {
  try {
    const response = await axios.get(SEARCH_URL, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9",
        "Accept-Encoding": "gzip, deflate",
        DNT: "1",
        Connection: "keep-alive",
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    const offers: ScrapedOffer[] = [];

    $("li.ui-search-layout__item").each((_, element) => {
      try {
        const $item = $(element);

        const $titleLink = $item.find("a.poly-component__title");
        const title = $titleLink.text().trim();
        const href = $titleLink.attr("href") ?? "";

        if (!title || !href) return;

        // Ignorar anúncios com URL de rastreamento dinâmica
        if (href.includes("click1.mercadolivre") || href.includes("mclics")) return;

        // Filtrar apenas console PS5 Pro
        const titleLower = title.toLowerCase();
        if (!isPS5ProConsole(titleLower)) return;

        const url = href.split("#")[0];
        const productId = extractProductId(href);

        const $priceContainer = $item.find("div.poly-price__current");
        const priceFraction = $priceContainer.find(".andes-money-amount__fraction").first().text().trim();
        const priceCents = $priceContainer.find(".andes-money-amount__cents").first().text().trim();

        if (!priceFraction) return;

        const price = parsePriceParts(priceFraction, priceCents);

        const $originalPrice = $item.find("s.andes-money-amount--previous");
        const origFraction = $originalPrice.find(".andes-money-amount__fraction").text().trim();
        const origCents = $originalPrice.find(".andes-money-amount__cents").text().trim();
        const originalPrice = origFraction ? parsePriceParts(origFraction, origCents) : undefined;

        const imageUrl = $item.find("img.poly-component__picture").attr("src");
        const outOfStock = $item.find(".poly-component__out-of-stock").length > 0;

        const ratingText = $item.find(".poly-phrase-label").first().text().trim();
        const rating = ratingText ? Math.round(parseFloat(ratingText.replace(",", ".")) * 100) : undefined;

        offers.push({ title, price, originalPrice, url, productId, imageUrl, rating, inStock: !outOfStock });
      } catch (err) {
        console.error("[MercadoLivre Scraper] Erro ao processar item:", err);
      }
    });

    console.log(`[MercadoLivre Scraper] Encontradas ${offers.length} ofertas`);
    return offers;
  } catch (error) {
    console.error("[MercadoLivre Scraper] Erro ao scraping:", error);
    return [];
  }
}
