import * as cheerio from "cheerio";
import { fetchHtmlWithBrowser } from "./http";

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

const BASE_URL = "https://www.casasbahia.com.br";


function parsePriceBRL(raw: unknown): number | undefined {
  if (typeof raw === "number" && raw > 0) return Math.round(raw * 100);
  if (typeof raw !== "string") return undefined;
  // "R$ 5.299,00" → 529900
  const cleaned = raw
    .replace(/[^\d,.]/g, "")
    .replace(/\.(?=\d{3})/g, "")
    .replace(",", ".");
  const val = parseFloat(cleaned);
  return isNaN(val) || val <= 0 ? undefined : Math.round(val * 100);
}

interface CbProduct {
  // campos comuns em VTEX/Next.js da Casas Bahia
  id?: unknown;
  productId?: unknown;
  name?: string;
  title?: string;
  price?: unknown;
  listPrice?: unknown;
  sellingPrice?: unknown;
  spotPrice?: unknown;
  prices?: { price?: unknown; listPrice?: unknown; sellingPrice?: unknown } | null;
  link?: string;
  linkText?: string;
  slug?: string;
  url?: string;
  images?: Array<{ imageUrl?: string; src?: string }>;
  image?: string;
  thumbnail?: string;
  rating?: unknown;
  ratingAverage?: unknown;
  reviews?: unknown;
  reviewCount?: unknown;
  totalReviews?: unknown;
  available?: unknown;
  availability?: unknown;
  inStock?: unknown;
  isAvailable?: unknown;
  quantity?: unknown;
}

function isProductLike(obj: unknown): boolean {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const p = obj as Record<string, unknown>;
  const hasTitle =
    typeof p.name === "string" ||
    typeof p.title === "string" ||
    typeof p.productName === "string";
  const hasPrice =
    p.price != null ||
    p.sellingPrice != null ||
    p.spotPrice != null ||
    (p.prices != null && typeof p.prices === "object");
  return hasTitle && !!hasPrice;
}

function deepFindProductArray(obj: unknown, depth = 0): CbProduct[] {
  if (depth > 12 || !obj || typeof obj !== "object") return [];

  if (Array.isArray(obj)) {
    if (obj.length > 0 && isProductLike(obj[0])) return obj as CbProduct[];
    for (const item of obj) {
      const found = deepFindProductArray(item, depth + 1);
      if (found.length > 0) return found;
    }
    return [];
  }

  const record = obj as Record<string, unknown>;
  const priorityKeys = [
    "products",
    "items",
    "data",
    "results",
    "productList",
    "catalog",
    "listing",
    "edges",
    "nodes",
    "searchResult",
    "productSearch",
  ];

  for (const key of priorityKeys) {
    if (key in record) {
      const found = deepFindProductArray(record[key], depth + 1);
      if (found.length > 0) return found;
    }
  }

  for (const [key, value] of Object.entries(record)) {
    if (priorityKeys.includes(key) || !value || typeof value !== "object") continue;
    const found = deepFindProductArray(value, depth + 1);
    if (found.length > 0) return found;
  }

  return [];
}

function resolvePrice(product: CbProduct): number | undefined {
  // Tenta campos de preço de maior para menor prioridade
  const candidates = [
    (product.prices as any)?.sellingPrice ?? (product.prices as any)?.price,
    product.spotPrice,
    product.sellingPrice,
    product.price,
    (product.prices as any)?.listPrice,
    product.listPrice,
  ];
  for (const c of candidates) {
    const p = parsePriceBRL(c);
    if (p) return p;
  }
  return undefined;
}

function resolveOriginalPrice(product: CbProduct): number | undefined {
  const candidates = [
    (product.prices as any)?.listPrice,
    product.listPrice,
  ];
  for (const c of candidates) {
    const p = parsePriceBRL(c);
    if (p) return p;
  }
  return undefined;
}

function resolveUrl(product: CbProduct): string {
  const raw =
    product.link ??
    product.url ??
    (product.slug ? `/${product.slug}/p` : undefined) ??
    (product.linkText ? `/${product.linkText}/p` : undefined) ??
    "";
  if (!raw) return "";
  if (raw.startsWith("http")) return raw;
  return `${BASE_URL}/${raw.replace(/^\//, "")}`;
}

function resolveProductId(product: CbProduct, url: string): string {
  const id = String(product.productId ?? product.id ?? "").trim();
  if (id) return id;
  // extrai do path: /..../123456789/p ou /produto/123456789
  const match = url.match(/\/(\d{7,})(?:\/p)?(?:[/?#]|$)/);
  return match?.[1] ?? url.split("/").filter(Boolean).pop() ?? "";
}

function resolveImage(product: CbProduct): string | undefined {
  if (Array.isArray(product.images) && product.images[0]) {
    return product.images[0].imageUrl ?? product.images[0].src;
  }
  return typeof product.image === "string"
    ? product.image
    : typeof product.thumbnail === "string"
    ? product.thumbnail
    : undefined;
}

function resolveInStock(product: CbProduct): boolean {
  const falsy = (v: unknown) => v === false || v === 0 || v === "false" || v === "unavailable";
  if (falsy(product.available)) return false;
  if (falsy(product.availability)) return false;
  if (falsy(product.inStock)) return false;
  if (falsy(product.isAvailable)) return false;
  if (product.quantity === 0) return false;
  return true;
}

function parseFromNextData(html: string): ScrapedOffer[] {
  const $ = cheerio.load(html);
  const script = $("#__NEXT_DATA__").html();
  if (!script) return [];

  let nextData: unknown;
  try {
    nextData = JSON.parse(script);
  } catch {
    console.warn("[Casas Bahia Scraper] Falha ao parsear __NEXT_DATA__");
    return [];
  }

  const products = deepFindProductArray(nextData);
  if (products.length === 0) {
    console.warn("[Casas Bahia Scraper] Nenhum array de produtos no __NEXT_DATA__");
    return [];
  }

  const offers: ScrapedOffer[] = [];

  for (const product of products) {
    try {
      const title = product.name ?? product.title ?? "";
      if (!title) continue;

      const price = resolvePrice(product);
      if (!price) continue;

      const originalPrice = resolveOriginalPrice(product);
      const url = resolveUrl(product);
      if (!url) continue;

      const productId = resolveProductId(product, url);
      const imageUrl = resolveImage(product);

      const ratingRaw = product.ratingAverage ?? product.rating;
      const rating =
        typeof ratingRaw === "number"
          ? Math.round(ratingRaw * 100)
          : typeof ratingRaw === "string"
          ? Math.round(parseFloat(ratingRaw) * 100) || undefined
          : undefined;

      const reviewRaw = product.totalReviews ?? product.reviewCount ?? product.reviews;
      const reviewCount =
        typeof reviewRaw === "number"
          ? reviewRaw
          : typeof reviewRaw === "string"
          ? parseInt(reviewRaw, 10) || undefined
          : undefined;

      offers.push({
        title,
        price,
        originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
        url,
        productId,
        imageUrl,
        sellerName: "Casas Bahia",
        rating,
        reviewCount,
        inStock: resolveInStock(product),
      });
    } catch (err) {
      console.error("[Casas Bahia Scraper] Erro ao processar produto via __NEXT_DATA__:", err);
    }
  }

  return offers;
}

function parseFromHtml(html: string): ScrapedOffer[] {
  const $ = cheerio.load(html);
  const offers: ScrapedOffer[] = [];

  // Casas Bahia usa diferentes versões de layout — tenta vários seletores
  const cardSelectors = [
    "[data-testid='product-card']",
    "article[class*='ProductCard']",
    "div[class*='ProductCard']",
    "li[class*='product']",
    "article",
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

      const $link = $card.find("a[href]").first();
      const href = $link.attr("href") ?? "";
      if (!href) return;

      const url = href.startsWith("http") ? href : `${BASE_URL}/${href.replace(/^\//, "")}`;
      const productId = resolveProductId({} as CbProduct, url);

      const titleSelectors = [
        "h2", "h3",
        "[class*='title' i]",
        "[class*='name' i]",
        "[data-testid='product-name']",
        "[data-testid='product-title']",
      ];
      let title = "";
      for (const sel of titleSelectors) {
        title = $card.find(sel).first().text().trim();
        if (title) break;
      }
      if (!title) return;

      const priceSelectors = [
        "[data-testid='price']",
        "[class*='price' i]:not([class*='old' i]):not([class*='list' i]):not([class*='from' i])",
        "[class*='selling' i]",
        "strong",
      ];
      let priceText = "";
      for (const sel of priceSelectors) {
        priceText = $card.find(sel).first().text().trim();
        if (priceText && priceText.includes("R$")) break;
      }
      const price = parsePriceBRL(priceText);
      if (!price) return;

      const origSelectors = [
        "[class*='listPrice' i]",
        "[class*='oldPrice' i]",
        "[class*='old' i]",
        "s",
        "del",
      ];
      let origText = "";
      for (const sel of origSelectors) {
        origText = $card.find(sel).first().text().trim();
        if (origText) break;
      }
      const originalPrice = origText ? parsePriceBRL(origText) : undefined;

      const imageUrl =
        $card.find("img[src]").first().attr("src") ??
        $card.find("img[data-src]").first().attr("data-src");

      const outOfStock =
        $card.find("[class*='unavailable' i], [class*='esgotado' i], [class*='indisponivel' i]").length > 0;

      offers.push({
        title,
        price,
        originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
        url,
        productId,
        imageUrl,
        sellerName: "Casas Bahia",
        inStock: !outOfStock,
      });
    } catch (err) {
      console.error("[Casas Bahia Scraper] Erro ao processar card HTML:", err);
    }
  });

  return offers;
}

export async function scrapeCasasBahia(searchQuery: string): Promise<ScrapedOffer[]> {
  const q = encodeURIComponent(searchQuery.trim());
  const searchUrl = `${BASE_URL}/busca?q=${q}`;

  try {
    const html = await fetchHtmlWithBrowser(searchUrl);

    const nextDataOffers = parseFromNextData(html);
    if (nextDataOffers.length > 0) {
      console.log(`[Casas Bahia Scraper] ${nextDataOffers.length} ofertas via __NEXT_DATA__`);
      return nextDataOffers;
    }

    const htmlOffers = parseFromHtml(html);
    if (htmlOffers.length > 0) {
      console.log(`[Casas Bahia Scraper] ${htmlOffers.length} ofertas via HTML`);
      return htmlOffers;
    }

    console.warn("[Casas Bahia Scraper] Nenhum produto encontrado — página pode exigir JS rendering ou IP bloqueado");
    return [];
  } catch (error) {
    console.error("[Casas Bahia Scraper] Erro ao scraping:", error);
    return [];
  }
}
