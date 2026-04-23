import { eq } from "drizzle-orm";
import { getDb, deleteStaleOffersForStore } from "./db";
import { offers, priceHistory, stores } from "../drizzle/schema";
import { scrapeMercadoLivre } from "./scrapers/mercadolivre";
import { scrapeAmazon } from "./scrapers/amazon";
import { scrapeMagazineLuiza } from "./scrapers/magazineluiza";
import { scrapeKabum } from "./scrapers/kabum";
import { getCatalogItem, DEFAULT_ITEM_ID, type MatchContext } from "../shared/catalog";
import { sendPriceDropEmail } from "./_core/email";

interface ScrapedOffer {
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

interface CrawlerStore {
  name: string;
  url: string;
  scraper: (searchQuery: string) => Promise<ScrapedOffer[]>;
}

const STORES: CrawlerStore[] = [
  {
    name: "Mercado Livre",
    url: "https://www.mercadolivre.com.br",
    scraper: scrapeMercadoLivre,
  },
  {
    name: "Amazon Brasil",
    url: "https://www.amazon.com.br",
    scraper: scrapeAmazon,
  },
  {
    name: "Magazine Luiza",
    url: "https://www.magazineluiza.com.br",
    scraper: scrapeMagazineLuiza,
  },
  {
    name: "KaBuM!",
    url: "https://www.kabum.com.br",
    scraper: scrapeKabum,
  },
  // Casas Bahia removida: Akamai Bot Manager bloqueia search/listing pages
  // para scraping automatizado mesmo com browser real. Requer proxies residenciais.
];

async function getOrCreateStore(name: string, url: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select().from(stores).where(eq(stores.name, name)).limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const [inserted] = await db.insert(stores).values({ name, url }).$returningId();

  return { id: inserted.id, name, url, createdAt: new Date() };
}

async function createOrUpdateOffer(
  storeId: number,
  scrapedOffer: ScrapedOffer
): Promise<{ id: number; isNew: boolean; previousPrice: number | null }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Verificar se já existe
  const existing = await db
    .select()
    .from(offers)
    .where(eq(offers.url, scrapedOffer.url))
    .limit(1);

  if (existing.length > 0) {
    // Atualizar oferta existente
    const existingOffer = existing[0];
    const previousPrice = existingOffer.price;

    await db
      .update(offers)
      .set({
        price: scrapedOffer.price,
        originalPrice: scrapedOffer.originalPrice,
        sellerName: scrapedOffer.sellerName,
        inStock: scrapedOffer.inStock ? 1 : 0,
        lastSeen: new Date(),
      })
      .where(eq(offers.id, existingOffer.id));

    // Registrar no histórico de preços se o preço mudou
    if (previousPrice !== scrapedOffer.price) {
      await db.insert(priceHistory).values({
        offerId: existingOffer.id,
        price: scrapedOffer.price,
        originalPrice: scrapedOffer.originalPrice,
        inStock: scrapedOffer.inStock ? 1 : 0,
      });
    }

    return {
      id: existingOffer.id,
      isNew: false,
      previousPrice: previousPrice !== scrapedOffer.price ? previousPrice : null,
    };
  } else {
    // Criar nova oferta
    const [inserted] = await db.insert(offers).values({
      storeId,
      title: scrapedOffer.title,
      price: scrapedOffer.price,
      originalPrice: scrapedOffer.originalPrice,
      url: scrapedOffer.url,
      productId: scrapedOffer.productId,
      imageUrl: scrapedOffer.imageUrl,
      sellerName: scrapedOffer.sellerName,
      inStock: scrapedOffer.inStock ? 1 : 0,
      rating: scrapedOffer.rating,
      reviewCount: scrapedOffer.reviewCount,
    }).$returningId();

    await db.insert(priceHistory).values({
      offerId: inserted.id,
      price: scrapedOffer.price,
      originalPrice: scrapedOffer.originalPrice,
      inStock: scrapedOffer.inStock ? 1 : 0,
    });

    return { id: inserted.id, isNew: true, previousPrice: null };
  }
}

export async function runCrawler(itemId = DEFAULT_ITEM_ID): Promise<{
  totalOffers: number;
  newOffers: number;
  updatedOffers: number;
  errors: string[];
}> {
  const catalogItem = getCatalogItem(itemId);
  console.log(`[Crawler] Iniciando ciclo para "${catalogItem.label}"...`);

  const startTime = Date.now();
  const errors: string[] = [];
  let totalOffers = 0;
  let newOffers = 0;
  let updatedOffers = 0;

  try {
    for (const storeConfig of STORES) {
      try {
        console.log(`[Crawler] Scraping ${storeConfig.name}...`);

        // Obter ou criar store
        const store = await getOrCreateStore(storeConfig.name, storeConfig.url);

        // Executar scraper e aplicar filtro do catálogo
        const rawOffers = await storeConfig.scraper(catalogItem.searchQuery);
        const scrapedOffers = rawOffers.filter((o) =>
          catalogItem.isMatch({ title: o.title.toLowerCase(), price: o.price })
        );

        if (rawOffers.length !== scrapedOffers.length) {
          console.log(`[Crawler] ${storeConfig.name}: ${rawOffers.length - scrapedOffers.length} itens descartados pelo filtro do catálogo`);
        }

        // Processar cada oferta
        for (const scrapedOffer of scrapedOffers) {
          try {
            const { isNew, previousPrice } = await createOrUpdateOffer(store.id, scrapedOffer);
            totalOffers++;
            if (isNew) {
              newOffers++;
            } else {
              updatedOffers++;
            }

            if (previousPrice !== null && scrapedOffer.price < previousPrice) {
              await sendPriceDropEmail({
                title: scrapedOffer.title,
                url: scrapedOffer.url,
                storeName: storeConfig.name,
                previousPrice,
                newPrice: scrapedOffer.price,
              });
            }
          } catch (error) {
            const errorMsg = `Erro ao processar oferta de ${storeConfig.name}: ${error}`;
            console.error(errorMsg);
            errors.push(errorMsg);
          }
        }

        // Remover ofertas desta loja que não apareceram no scrape atual
        // (itens obsoletos, fora de catálogo ou filtrados pelas novas regras)
        // Só executa se o scraper retornou resultados — protege contra wipe por falha silenciosa
        if (scrapedOffers.length > 0) {
          const activeUrls = scrapedOffers.map((o) => o.url);
          const removed = await deleteStaleOffersForStore(store.id, activeUrls);
          if (removed > 0) {
            console.log(`[Crawler] ${storeConfig.name}: ${removed} ofertas obsoletas removidas`);
          }
        }

        console.log(
          `[Crawler] ${storeConfig.name}: ${scrapedOffers.length} ofertas processadas`
        );
      } catch (error) {
        const errorMsg = `Erro ao scraping ${storeConfig.name}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[Crawler] Ciclo concluído em ${duration}ms. Total: ${totalOffers}, Novas: ${newOffers}, Atualizadas: ${updatedOffers}`
    );

    return {
      totalOffers,
      newOffers,
      updatedOffers,
      errors,
    };
  } catch (error) {
    const errorMsg = `Erro geral no crawler: ${error}`;
    console.error(errorMsg);
    errors.push(errorMsg);

    return {
      totalOffers,
      newOffers,
      updatedOffers,
      errors,
    };
  }
}
