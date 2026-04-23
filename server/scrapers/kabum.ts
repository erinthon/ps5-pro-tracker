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

const BASE_URL = "https://www.kabum.com.br";

// Extra headers específicos do KaBuM para reduzir chance de bloqueio
const KABUM_HEADERS: Record<string, string> = {
  Referer: `${BASE_URL}/`,
  Origin: BASE_URL,
};

function parsePriceBRL(raw: unknown): number | undefined {
  if (typeof raw === "number") return Math.round(raw * 100);
  if (typeof raw !== "string") return undefined;
  // "R$ 5.299,00" → 529900
  const cleaned = raw
    .replace(/[^\d,.]/g, "")
    .replace(/\.(?=\d{3})/g, "")
    .replace(",", ".");
  const val = parseFloat(cleaned);
  return isNaN(val) ? undefined : Math.round(val * 100);
}

interface KabumProduct {
  code?: unknown;
  title?: string;
  name?: string;
  price?: unknown;
  price_with_discount?: unknown;
  original_price?: unknown;
  url_path?: string;
  slug?: string;
  media?: Array<{ image?: string }>;
  image?: string;
  rating?: unknown;
  review_count?: unknown;
  reviewCount?: unknown;
  available?: unknown;
  in_stock?: unknown;
}

function isProductLike(obj: unknown): boolean {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const p = obj as Record<string, unknown>;
  const hasTitle = typeof p.title === "string" || typeof p.name === "string";
  const hasPrice = p.price !== undefined || p.price_with_discount !== undefined;
  return hasTitle && hasPrice;
}

/**
 * Busca recursiva no JSON do __NEXT_DATA__ para encontrar o primeiro array
 * cujos elementos parecem produtos KaBuM. Resiliente a mudanças de estrutura.
 */
function deepFindProductArray(obj: unknown, depth = 0): KabumProduct[] {
  if (depth > 10 || !obj || typeof obj !== "object") return [];

  if (Array.isArray(obj)) {
    if (obj.length > 0 && isProductLike(obj[0])) return obj as KabumProduct[];
    for (const item of obj) {
      const found = deepFindProductArray(item, depth + 1);
      if (found.length > 0) return found;
    }
    return [];
  }

  const record = obj as Record<string, unknown>;

  // Prioriza chaves com alta probabilidade de conter produtos
  const priorityKeys = ["products", "data", "productList", "items", "results", "catalog", "listing"];
  for (const key of priorityKeys) {
    if (key in record) {
      const found = deepFindProductArray(record[key], depth + 1);
      if (found.length > 0) return found;
    }
  }

  // Fallback: percorre todas as chaves restantes
  for (const [key, value] of Object.entries(record)) {
    if (priorityKeys.includes(key) || !value || typeof value !== "object") continue;
    const found = deepFindProductArray(value, depth + 1);
    if (found.length > 0) return found;
  }

  return [];
}

function buildProductUrl(product: KabumProduct): string {
  const code = String(product.code ?? "").trim();
  const slug = (product.url_path ?? product.slug ?? "").trim().replace(/^\//, "");

  if (slug.startsWith("http")) return slug;
  if (slug && code) return `${BASE_URL}/produto/${code}/${slug}`;
  if (slug) return `${BASE_URL}/produto/${slug}`;
  if (code) return `${BASE_URL}/produto/${code}`;
  return "";
}

function parseFromNextData(html: string): ScrapedOffer[] {
  const $ = cheerio.load(html);
  const nextDataScript = $("#__NEXT_DATA__").html();
  if (!nextDataScript) return [];

  let nextData: unknown;
  try {
    nextData = JSON.parse(nextDataScript);
  } catch {
    console.warn("[KaBuM Scraper] __NEXT_DATA__ encontrado mas falhou ao parsear JSON");
    return [];
  }

  const products = deepFindProductArray(nextData);
  if (products.length === 0) {
    console.warn("[KaBuM Scraper] __NEXT_DATA__ parseado mas nenhum array de produtos encontrado");
    return [];
  }

  const offers: ScrapedOffer[] = [];

  for (const product of products) {
    try {
      const title = product.title ?? product.name ?? "";
      if (!title) continue;

      const price = parsePriceBRL(product.price_with_discount ?? product.price);
      if (!price) continue;

      const originalPrice = parsePriceBRL(product.original_price);
      const url = buildProductUrl(product);
      if (!url) continue;

      const code = String(product.code ?? "").trim();
      const slug = (product.url_path ?? product.slug ?? "").trim();

      const imageUrl =
        (Array.isArray(product.media) ? product.media[0]?.image : undefined) ??
        (typeof product.image === "string" ? product.image : undefined);

      const ratingRaw = product.rating;
      const rating =
        typeof ratingRaw === "number"
          ? Math.round(ratingRaw * 100)
          : typeof ratingRaw === "string"
          ? Math.round(parseFloat(ratingRaw) * 100) || undefined
          : undefined;

      const reviewRaw = product.review_count ?? product.reviewCount;
      const reviewCount =
        typeof reviewRaw === "number"
          ? reviewRaw
          : typeof reviewRaw === "string"
          ? parseInt(reviewRaw, 10) || undefined
          : undefined;

      const inStock =
        product.available !== false &&
        product.available !== 0 &&
        product.in_stock !== false &&
        product.in_stock !== 0;

      offers.push({
        title,
        price,
        originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
        url,
        productId: code || slug,
        imageUrl,
        sellerName: "KaBuM!",
        rating,
        reviewCount,
        inStock,
      });
    } catch (err) {
      console.error("[KaBuM Scraper] Erro ao processar produto via __NEXT_DATA__:", err);
    }
  }

  return offers;
}

function parseFromHtml(html: string): ScrapedOffer[] {
  const $ = cheerio.load(html);
  const offers: ScrapedOffer[] = [];

  const cardSelectors = [
    "article.productCard",
    "[data-testid='product-card']",
    "article[class*='Card']",
    "div[class*='productCard']",
  ];

  let $cards = $();
  for (const sel of cardSelectors) {
    $cards = $(sel);
    if ($cards.length > 0) break;
  }

  if ($cards.length === 0) return [];

  $cards.each((_, element) => {
    try {
      const $card = $(element);

      const $link = $card.find("a[href*='/produto/']").first();
      const href = $link.attr("href") ?? $card.closest("a[href*='/produto/']").attr("href") ?? "";
      if (!href) return;

      const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;
      const codeMatch = href.match(/\/produto\/(\d+)/);
      const productId = codeMatch?.[1] ?? href.split("/").filter(Boolean).pop() ?? "";

      const titleSelectors = [
        "span.nameCard",
        "h2.nameCard",
        "[class*='nameCard']",
        "[class*='title']",
        "h2",
        "span[class*='Name']",
      ];
      let title = "";
      for (const sel of titleSelectors) {
        title = $card.find(sel).first().text().trim();
        if (title) break;
      }
      if (!title) return;

      const priceSelectors = [
        "span.priceCard",
        "[class*='priceCard']",
        "[data-testid='price']",
        "span[class*='Price']:not([class*='old']):not([class*='Old'])",
      ];
      let priceText = "";
      for (const sel of priceSelectors) {
        priceText = $card.find(sel).first().text().trim();
        if (priceText) break;
      }
      const price = parsePriceBRL(priceText);
      if (!price) return;

      const origSelectors = [
        "span.oldPriceCard",
        "[class*='oldPrice']",
        "[class*='OldPrice']",
        "s[class*='Price']",
      ];
      let origText = "";
      for (const sel of origSelectors) {
        origText = $card.find(sel).first().text().trim();
        if (origText) break;
      }
      const originalPrice = origText ? parsePriceBRL(origText) : undefined;

      const imageUrl = $card.find("img").first().attr("src");
      const outOfStock =
        $card.find("[class*='unavailable' i], [class*='esgotado' i], [class*='indisponivel' i]").length > 0;

      offers.push({
        title,
        price,
        originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
        url,
        productId,
        imageUrl,
        sellerName: "KaBuM!",
        inStock: !outOfStock,
      });
    } catch (err) {
      console.error("[KaBuM Scraper] Erro ao processar card HTML:", err);
    }
  });

  return offers;
}

export async function scrapeKabum(searchQuery: string): Promise<ScrapedOffer[]> {
  const slug = searchQuery.trim().replace(/\s+/g, "-").toLowerCase();
  const searchUrl = `${BASE_URL}/busca/${slug}`;

  try {
    const html = await fetchHtml(searchUrl, KABUM_HEADERS);

    const nextDataOffers = parseFromNextData(html);
    if (nextDataOffers.length > 0) {
      console.log(`[KaBuM Scraper] ${nextDataOffers.length} ofertas via __NEXT_DATA__`);
      return nextDataOffers;
    }

    const htmlOffers = parseFromHtml(html);
    if (htmlOffers.length > 0) {
      console.log(`[KaBuM Scraper] ${htmlOffers.length} ofertas via HTML`);
      return htmlOffers;
    }

    console.warn("[KaBuM Scraper] Nenhum produto encontrado — página pode exigir JS rendering ou IP bloqueado");
    return [];
  } catch (error) {
    console.error("[KaBuM Scraper] Erro ao scraping:", error);
    return [];
  }
}
