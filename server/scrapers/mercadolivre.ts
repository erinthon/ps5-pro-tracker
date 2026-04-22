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

export async function scrapeMercadoLivre(searchQuery: string): Promise<ScrapedOffer[]> {
  const searchUrl = `https://lista.mercadolivre.com.br/${searchQuery.replace(/\s+/g, "-")}`;
  try {
    const html = await fetchHtml(searchUrl);
    const $ = cheerio.load(html);
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

        // Build stable URL: strip position/session params but keep wid (specific seller listing).
        // Without wid the link goes to the catalog page which may show a different seller's price.
        const basePath = href.split("#")[0].split("?")[0];
        const widMatch = href.match(/[#?&]wid=([^&#]+)/);
        const url = widMatch ? `${basePath}?wid=${widMatch[1]}` : basePath;
        const productId = extractProductId(href);

        const $priceContainer = $item.find("div.poly-price__current");

        // Prefer machine-readable itemprop content — avoids picking up installment amounts
        const itemPropPrice = $priceContainer.find("[itemprop='price']").attr("content");
        let price: number;
        if (itemPropPrice) {
          price = Math.round(parseFloat(itemPropPrice) * 100);
        } else {
          // Fallback: use the first .andes-money-amount__fraction in the container
          const priceFraction = $priceContainer.find(".andes-money-amount__fraction").first().text().trim();
          const priceCents = $priceContainer.find(".andes-money-amount__cents").first().text().trim();
          if (!priceFraction) return;
          price = parsePriceParts(priceFraction, priceCents);
        }

        if (!price) return;

        const $originalPrice = $item.find("s.andes-money-amount--previous");
        const origFraction = $originalPrice.find(".andes-money-amount__fraction").text().trim();
        const origCents = $originalPrice.find(".andes-money-amount__cents").text().trim();
        const originalPrice = origFraction ? parsePriceParts(origFraction, origCents) : undefined;

        const imageUrl = $item.find("img.poly-component__picture").attr("src");
        const outOfStock = $item.find(".poly-component__out-of-stock").length > 0;

        const ratingText = $item.find(".poly-phrase-label").first().text().trim();
        const rating = ratingText ? Math.round(parseFloat(ratingText.replace(",", ".")) * 100) : undefined;

        const reviewText = $item.find(".poly-reviews__total").first().text().trim();
        const reviewCount = reviewText ? parseInt(reviewText.replace(/\D/g, ""), 10) || undefined : undefined;

        const sellerName =
          $item.find(".poly-component__seller").text().trim() ||
          $item.find("[data-testid='seller-name']").text().trim() ||
          undefined;

        offers.push({ title, price, originalPrice, url, productId, imageUrl, sellerName, rating, reviewCount, inStock: !outOfStock });
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
