import { eq, and, gte, lte } from "drizzle-orm";
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

  const conditions = [];

  if (params.minPrice !== undefined) {
    conditions.push(gte(offers.price, params.minPrice));
  }
  if (params.maxPrice !== undefined) {
    conditions.push(lte(offers.price, params.maxPrice));
  }
  if (params.storeId !== undefined) {
    conditions.push(eq(offers.storeId, params.storeId));
  }
  if (params.inStock !== undefined) {
    conditions.push(eq(offers.inStock, params.inStock ? 1 : 0));
  }

  let baseQuery = db.select().from(offers);

  if (conditions.length > 0) {
    baseQuery = baseQuery.where(and(...conditions)) as any;
  }

  if (params.limit) {
    baseQuery = baseQuery.limit(params.limit) as any;
  }
  if (params.offset) {
    baseQuery = baseQuery.offset(params.offset) as any;
  }

  return baseQuery;
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
