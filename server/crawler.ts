import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { offers, priceHistory, stores } from "../drizzle/schema";
import { scrapeMercadoLivre } from "./scrapers/mercadolivre";
import { scrapeAmazon } from "./scrapers/amazon";
import { scrapeMagazineLuiza } from "./scrapers/magazineluiza";

interface ScrapedOffer {
  title: string;
  price: number;
  originalPrice?: number;
  url: string;
  productId: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
  inStock: boolean;
}

interface CrawlerStore {
  name: string;
  url: string;
  scraper: () => Promise<ScrapedOffer[]>;
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

async function isDuplicateOffer(url: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const existing = await db.select().from(offers).where(eq(offers.url, url)).limit(1);
  return existing.length > 0;
}

async function createOrUpdateOffer(
  storeId: number,
  scrapedOffer: ScrapedOffer
): Promise<{ id: number; isNew: boolean }> {
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
    await db
      .update(offers)
      .set({
        price: scrapedOffer.price,
        originalPrice: scrapedOffer.originalPrice,
        inStock: scrapedOffer.inStock ? 1 : 0,
        lastSeen: new Date(),
      })
      .where(eq(offers.id, existingOffer.id));

    // Registrar no histórico de preços se o preço mudou
    if (existingOffer.price !== scrapedOffer.price) {
      await db.insert(priceHistory).values({
        offerId: existingOffer.id,
        price: scrapedOffer.price,
        originalPrice: scrapedOffer.originalPrice,
        inStock: scrapedOffer.inStock ? 1 : 0,
      });
    }

    return { id: existingOffer.id, isNew: false };
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
      description: scrapedOffer.title,
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

    return { id: inserted.id, isNew: true };
  }
}

async function clearOffers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // priceHistory deletes via cascade
  await db.delete(offers);
  console.log("[Crawler] Lista de ofertas limpa");
}

export async function runCrawler(): Promise<{
  totalOffers: number;
  newOffers: number;
  updatedOffers: number;
  errors: string[];
}> {
  console.log("[Crawler] Iniciando ciclo de scraping...");

  const startTime = Date.now();
  const errors: string[] = [];
  let totalOffers = 0;
  let newOffers = 0;
  let updatedOffers = 0;

  try {
    await clearOffers();

    for (const storeConfig of STORES) {
      try {
        console.log(`[Crawler] Scraping ${storeConfig.name}...`);

        // Obter ou criar store
        const store = await getOrCreateStore(storeConfig.name, storeConfig.url);

        // Executar scraper
        const scrapedOffers = await storeConfig.scraper();

        // Processar cada oferta
        for (const scrapedOffer of scrapedOffers) {
          try {
            const { isNew } = await createOrUpdateOffer(store.id, scrapedOffer);
            totalOffers++;
            if (isNew) {
              newOffers++;
            } else {
              updatedOffers++;
            }
          } catch (error) {
            const errorMsg = `Erro ao processar oferta de ${storeConfig.name}: ${error}`;
            console.error(errorMsg);
            errors.push(errorMsg);
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
