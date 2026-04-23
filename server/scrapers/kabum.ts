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

function extractProducts(data: unknown): KabumProduct[] {
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;

  const paths = [
    () => (obj as any)?.props?.pageProps?.productList?.data,
    () => (obj as any)?.props?.pageProps?.productList?.products,
    () => (obj as any)?.props?.pageProps?.products,
    () => (obj as any)?.props?.pageProps?.data?.products,
    () => (obj as any)?.props?.pageProps?.initialData?.products,
    () => (obj as any)?.props?.pageProps?.search?.products,
  ];

  for (const get of paths) {
    try {
      const products = get();
      if (Array.isArray(products) && products.length > 0) return products;
    } catch {}
  }

  return [];
}

function parseFromNextData(html: string): ScrapedOffer[] {
  const $ = cheerio.load(html);
  const nextDataScript = $("#__NEXT_DATA__").html();
  if (!nextDataScript) return [];

  let nextData: unknown;
  try {
    nextData = JSON.parse(nextDataScript);
  } catch {
    return [];
  }

  const products = extractProducts(nextData);
  if (products.length === 0) return [];

  const offers: ScrapedOffer[] = [];

  for (const product of products) {
    try {
      const title = product.title ?? product.name ?? "";
      if (!title) continue;

      const price = parsePriceBRL(product.price_with_discount ?? product.price);
      if (!price) continue;

      const originalPrice = parsePriceBRL(product.original_price);

      const code = String(product.code ?? "");
      const slug = product.url_path ?? product.slug ?? "";
      const url = slug
        ? slug.startsWith("http")
          ? slug
          : `${BASE_URL}/produto/${code}/${slug.replace(/^\//, "")}`
        : code
        ? `${BASE_URL}/produto/${code}`
        : "";
      if (!url) continue;

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

  // KaBuM product cards — selectors based on their current HTML structure
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

      // Extract product code from /produto/{code}/...
      const codeMatch = href.match(/\/produto\/(\d+)/);
      const productId = codeMatch?.[1] ?? href.split("/").filter(Boolean).pop() ?? "";

      const titleSelectors = ["span.nameCard", "h2.nameCard", "[class*='nameCard']", "[class*='title']", "h2", "span[class*='Name']"];
      let title = "";
      for (const sel of titleSelectors) {
        title = $card.find(sel).first().text().trim();
        if (title) break;
      }
      if (!title) return;

      // Current price (avoid crossed-out original price)
      const priceSelectors = ["span.priceCard", "[class*='priceCard']", "[data-testid='price']", "span[class*='Price']:not([class*='old']):not([class*='Old'])"];
      let priceText = "";
      for (const sel of priceSelectors) {
        priceText = $card.find(sel).first().text().trim();
        if (priceText) break;
      }
      const price = parsePriceBRL(priceText);
      if (!price) return;

      const origSelectors = ["span.oldPriceCard", "[class*='oldPrice']", "[class*='OldPrice']", "s[class*='Price']"];
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
    const html = await fetchHtml(searchUrl);

    // Prefer __NEXT_DATA__ (structured, stable) over CSS selectors
    const nextDataOffers = parseFromNextData(html);
    if (nextDataOffers.length > 0) {
      console.log(`[KaBuM Scraper] Encontradas ${nextDataOffers.length} ofertas via __NEXT_DATA__`);
      return nextDataOffers;
    }

    // Fallback: parse rendered HTML cards
    const htmlOffers = parseFromHtml(html);
    if (htmlOffers.length > 0) {
      console.log(`[KaBuM Scraper] Encontradas ${htmlOffers.length} ofertas via HTML`);
      return htmlOffers;
    }

    console.warn("[KaBuM Scraper] Nenhum produto encontrado — página pode exigir JS rendering");
    return [];
  } catch (error) {
    console.error("[KaBuM Scraper] Erro ao scraping:", error);
    return [];
  }
}
