import * as cheerio from "cheerio";
import { fetchHtml } from "./http";

export interface ScrapedOffer {
  title: string;
  price: number; // em centavos
  originalPrice?: number;
  url: string;
  productId: string;
  imageUrl?: string;
  sellerName?: string;
  rating?: number;
  reviewCount?: number;
  inStock: boolean;
}

function parsePriceParts(whole: string, fraction?: string): number {
  // Amazon: "5.999" whole + "99" fraction
  const intPart = parseInt(whole.replace(/\D/g, ""), 10) || 0;
  const centPart = parseInt((fraction ?? "").replace(/\D/g, "").padEnd(2, "0").slice(0, 2), 10) || 0;
  return intPart * 100 + centPart;
}

export async function scrapeAmazon(searchQuery: string): Promise<ScrapedOffer[]> {
  const searchUrl = `https://www.amazon.com.br/s?k=${encodeURIComponent(searchQuery)}`;
  try {
    const html = await fetchHtml(searchUrl);
    const $ = cheerio.load(html);
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

        // Exclude .a-text-price (crossed-out original) — it appears first in DOM and would be picked up by .first()
        const priceText = $item.find("span.a-price:not(.a-text-price) span.a-offscreen").first().text().trim();
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

        // Vendedor: "Vendido por X" aparece em alguns resultados do search
        const soldByText = $item.find(".a-row.a-size-base.a-color-secondary").text();
        const soldByMatch = soldByText.match(/Vendido por\s+(.+)/i);
        const sellerName = soldByMatch?.[1]?.trim() || undefined;

        offers.push({ title, price, originalPrice, url, productId, imageUrl, sellerName, rating, reviewCount, inStock: !outOfStock });
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
