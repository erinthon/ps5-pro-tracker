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

const SEARCH_URL = "https://www.amazon.com.br/s?k=console+playstation+5+pro";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function parsePriceParts(whole: string, fraction?: string): number {
  // Amazon: "5.999" whole + "99" fraction
  const intPart = parseInt(whole.replace(/\D/g, ""), 10) || 0;
  const centPart = parseInt((fraction ?? "").replace(/\D/g, "").padEnd(2, "0").slice(0, 2), 10) || 0;
  return intPart * 100 + centPart;
}

export async function scrapeAmazon(): Promise<ScrapedOffer[]> {
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

    $("div[data-component-type='s-search-result']").each((_, element) => {
      try {
        const $item = $(element);

        const productId = $item.attr("data-asin") ?? "";
        if (!productId) return;

        const title = $item.find("h2 span").first().text().trim();
        const href = $item.find("div[data-cy='title-recipe'] a").attr("href") ?? "";

        if (!title || !href) return;

        const cleanPath = href.split("?")[0];
        const url = cleanPath.startsWith("http") ? cleanPath : `https://www.amazon.com.br${cleanPath}`;

        const priceText = $item.find("span.a-offscreen").first().text().trim();
        if (!priceText) return;

        // Formato: "R$ 8.099,00"
        const cleaned = priceText.replace(/[^\d,]/g, "").replace(".", "").replace(",", ".");
        const price = Math.round(parseFloat(cleaned) * 100);
        if (!price) return;

        const origPriceText = $item.find("span.a-price.a-text-price span.a-offscreen").first().text().trim();
        let originalPrice: number | undefined;
        if (origPriceText) {
          const origCleaned = origPriceText.replace(/[^\d,]/g, "").replace(".", "").replace(",", ".");
          originalPrice = Math.round(parseFloat(origCleaned) * 100) || undefined;
        }

        const imageUrl = $item.find("img.s-image").attr("src");
        const outOfStock = $item.find(".s-color-unavailable").length > 0;

        const ratingText = $item.find("span.a-icon-alt").first().text();
        const ratingMatch = ratingText.match(/([\d,]+)\s+de\s+5/);
        const rating = ratingMatch ? Math.round(parseFloat(ratingMatch[1].replace(",", ".")) * 100) : undefined;

        const reviewText = $item.find("span.a-size-base.s-underline-text").first().text().trim();
        const reviewCount = reviewText ? parseInt(reviewText.replace(/\D/g, ""), 10) || undefined : undefined;

        if (!isPS5ProConsole(title.toLowerCase())) return;

        offers.push({ title, price, originalPrice, url, productId, imageUrl, rating, reviewCount, inStock: !outOfStock });
      } catch (err) {
        console.error("[Amazon Scraper] Erro ao processar item:", err);
      }
    });

    console.log(`[Amazon Scraper] Encontradas ${offers.length} ofertas`);
    return offers;
  } catch (error) {
    console.error("[Amazon Scraper] Erro ao scraping:", error);
    return [];
  }
}
