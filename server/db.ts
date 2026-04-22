import { eq, and, gte, lte, notInArray, SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, offers, priceHistory, stores } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Ofertas queries
export async function getOffersWithFilters(params: {
  minPrice?: number;
  maxPrice?: number;
  storeId?: number;
  inStock?: boolean;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: SQL[] = [];

  if (params.minPrice !== undefined) conditions.push(gte(offers.price, params.minPrice));
  if (params.maxPrice !== undefined) conditions.push(lte(offers.price, params.maxPrice));
  if (params.storeId !== undefined) conditions.push(eq(offers.storeId, params.storeId));
  if (params.inStock !== undefined) conditions.push(eq(offers.inStock, params.inStock ? 1 : 0));

  return db
    .select({
      id: offers.id,
      storeId: offers.storeId,
      storeName: stores.name,
      title: offers.title,
      price: offers.price,
      originalPrice: offers.originalPrice,
      url: offers.url,
      imageUrl: offers.imageUrl,
      sellerName: offers.sellerName,
      inStock: offers.inStock,
      rating: offers.rating,
      reviewCount: offers.reviewCount,
      lastSeen: offers.lastSeen,
      createdAt: offers.createdAt,
    })
    .from(offers)
    .leftJoin(stores, eq(offers.storeId, stores.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(params.limit ?? 50)
    .offset(params.offset ?? 0);
}

export async function getOfferById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(offers).where(eq(offers.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getPriceHistoryForOffer(offerId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(priceHistory).where(eq(priceHistory.offerId, offerId));
}

export async function getStores() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(stores);
}

/**
 * Remove ofertas de uma loja que não estão na lista de URLs ativas.
 * Chamado após cada scrape bem-sucedido para limpar itens obsoletos ou filtrados.
 * Não executa se activeUrls estiver vazio (proteção contra wipe acidental em falha do scraper).
 */
export async function deleteStaleOffersForStore(storeId: number, activeUrls: string[]): Promise<number> {
  const db = await getDb();
  if (!db || activeUrls.length === 0) return 0;

  const result = await db
    .delete(offers)
    .where(and(eq(offers.storeId, storeId), notInArray(offers.url, activeUrls)));

  return (result as any)?.[0]?.affectedRows ?? 0;
}
