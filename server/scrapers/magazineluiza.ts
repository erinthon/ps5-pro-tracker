import * as cheerio from "cheerio";
import { fetchHtml } from "./http";

export interface ScrapedOffer {
  title: string;
  price: number;
  originalPrice?: number;
  url: string;
  productId: string;
  imageUrl?: string;
  sellerName?: string;
  rating?: number;
  reviewCount?: number;
  inStock: boolean;
}

const BASE_URL = "https://www.magazineluiza.com.br";

function parsePriceBRL(raw: unknown): number | undefined {
  if (typeof raw === "number") return Math.round(raw * 100);
  if (typeof raw !== "string") return undefined;
  // "R$ 4.499,00" or "4499.00" or "4499,00"
  const cleaned = raw.replace(/[^\d,.]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".");
  const val = parseFloat(cleaned);
  return isNaN(val) ? undefined : Math.round(val * 100);
}

interface MagaluProduct {
  title?: string;
  price?: unknown;
  best_price?: unknown;
  original_price?: unknown;
  id?: string;
  slug?: string;
  seller_id?: string;
  seller_description?: string;
  url?: string;
  image?: string;
  rating?: unknown;
  reviews_count?: unknown;
  available?: unknown;
  inStock?: unknown;
}

function extractProducts(data: unknown): MagaluProduct[] {
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;

  // Tenta vários caminhos conhecidos do __NEXT_DATA__ do Magalu
  const paths = [
    () => (obj as any)?.props?.pageProps?.search?.products,
    () => (obj as any)?.props?.pageProps?.products,
    () => (obj as any)?.props?.pageProps?.searchData?.products,
    () => (obj as any)?.props?.pageProps?.initialState?.search?.products,
  ];

  for (const get of paths) {
    try {
      const products = get();
      if (Array.isArray(products) && products.length > 0) return products;
    } catch {}
  }

  return [];
}

export async function scrapeMagazineLuiza(searchQuery: string): Promise<ScrapedOffer[]> {
  const slug = searchQuery.trim().replace(/\s+/g, "+");
  const searchUrl = `${BASE_URL}/busca/${slug}/`;

  try {
    const html = await fetchHtml(searchUrl);
    const $ = cheerio.load(html);
    const nextDataScript = $("#__NEXT_DATA__").html();

    if (!nextDataScript) {
      console.warn("[Magazine Luiza Scraper] __NEXT_DATA__ não encontrado — site pode exigir JS rendering");
      return [];
    }

    const nextData = JSON.parse(nextDataScript);
    const products = extractProducts(nextData);

    if (products.length === 0) {
      console.warn("[Magazine Luiza Scraper] Nenhum produto encontrado no __NEXT_DATA__");
      return [];
    }

    const offers: ScrapedOffer[] = [];

    for (const product of products) {
      try {
        const title = product.title ?? "";
        if (!title) continue;

        const price = parsePriceBRL(product.best_price ?? product.price);
        if (!price) continue;

        const originalPrice = parsePriceBRL(product.original_price);

        const productId = String(product.id ?? product.slug ?? "");
        const sellerId = product.seller_id ?? "magazineluiza";

        const rawUrl = product.url ?? product.slug ?? "";
        const url = rawUrl.startsWith("http")
          ? rawUrl
          : `${BASE_URL}/${rawUrl.replace(/^\//, "")}`;

        const imageUrl = typeof product.image === "string" ? product.image : undefined;

        const ratingRaw = product.rating;
        const rating =
          typeof ratingRaw === "number"
            ? Math.round(ratingRaw * 100)
            : typeof ratingRaw === "string"
            ? Math.round(parseFloat(ratingRaw) * 100) || undefined
            : undefined;

        const reviewRaw = product.reviews_count;
        const reviewCount =
          typeof reviewRaw === "number"
            ? reviewRaw
            : typeof reviewRaw === "string"
            ? parseInt(reviewRaw, 10) || undefined
            : undefined;

        const inStock =
          product.available !== false &&
          product.available !== 0 &&
          product.inStock !== false &&
          product.inStock !== 0;

        const sellerName =
          typeof product.seller_description === "string" && product.seller_description
            ? product.seller_description
            : sellerId !== "magazineluiza"
            ? sellerId
            : "Magazine Luiza";

        offers.push({
          title,
          price,
          originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
          url,
          productId: `${sellerId}-${productId}`,
          imageUrl,
          sellerName,
          rating,
          reviewCount,
          inStock,
        });
      } catch (err) {
        console.error("[Magazine Luiza Scraper] Erro ao processar produto:", err);
      }
    }

    console.log(`[Magazine Luiza Scraper] Encontradas ${offers.length} ofertas`);
    return offers;
  } catch (error) {
    console.error("[Magazine Luiza Scraper] Erro ao scraping:", error);
    return [];
  }
}
