import { type OpertoSettings, settings, tokens, type InsertSettings, type InsertTokens } from "@shared/schema";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);

export interface IStorage {
  getSettings(): Promise<OpertoSettings | undefined>;
  saveSettings(settings: OpertoSettings): Promise<OpertoSettings>;
  getAccessToken(): Promise<string | undefined>;
  saveAccessToken(token: string): Promise<void>;
  clearAccessToken(): Promise<void>;
}

export class DbStorage implements IStorage {
  async getSettings(): Promise<OpertoSettings | undefined> {
    const result = await db.select().from(settings).limit(1);
    if (result.length === 0) {
      return undefined;
    }
    const row = result[0];
    return {
      apiKey: row.apiKey,
      apiValue: row.apiValue,
      completed: row.completed || undefined,
      taskStartDate: row.taskStartDate || undefined,
      taskEndDate: row.taskEndDate || undefined,
      perPage: row.perPage || undefined,
    };
  }

  async saveSettings(settingsData: OpertoSettings): Promise<OpertoSettings> {
    const existing = await db.select().from(settings).limit(1);
    
    if (existing.length === 0) {
      await db.insert(settings).values({
        apiKey: settingsData.apiKey,
        apiValue: settingsData.apiValue,
        completed: settingsData.completed,
        taskStartDate: settingsData.taskStartDate,
        taskEndDate: settingsData.taskEndDate,
        perPage: settingsData.perPage,
      });
    } else {
      await db.update(settings)
        .set({
          apiKey: settingsData.apiKey,
          apiValue: settingsData.apiValue,
          completed: settingsData.completed,
          taskStartDate: settingsData.taskStartDate,
          taskEndDate: settingsData.taskEndDate,
          perPage: settingsData.perPage,
          updatedAt: new Date(),
        })
        .where(eq(settings.id, 1));
    }
    
    return settingsData;
  }

  async getAccessToken(): Promise<string | undefined> {
    const result = await db.select().from(tokens).limit(1);
    if (result.length === 0) {
      return undefined;
    }
    return result[0].accessToken;
  }

  async saveAccessToken(token: string): Promise<void> {
    const existing = await db.select().from(tokens).limit(1);
    
    if (existing.length === 0) {
      await db.insert(tokens).values({
        accessToken: token,
      });
    } else {
      await db.update(tokens)
        .set({
          accessToken: token,
          updatedAt: new Date(),
        })
        .where(eq(tokens.id, 1));
    }
  }

  async clearAccessToken(): Promise<void> {
    await db.delete(tokens).where(eq(tokens.id, 1));
  }
}

export const storage = new DbStorage();
