import { type OpertoSettings } from "@shared/schema";

export interface IStorage {
  getSettings(): Promise<OpertoSettings | undefined>;
  saveSettings(settings: OpertoSettings): Promise<OpertoSettings>;
  getAccessToken(): Promise<string | undefined>;
  saveAccessToken(token: string): Promise<void>;
  clearAccessToken(): Promise<void>;
}

export class MemStorage implements IStorage {
  private settings: OpertoSettings | undefined;
  private accessToken: string | undefined;

  constructor() {
    this.settings = undefined;
    this.accessToken = undefined;
  }

  async getSettings(): Promise<OpertoSettings | undefined> {
    return this.settings;
  }

  async saveSettings(settings: OpertoSettings): Promise<OpertoSettings> {
    this.settings = settings;
    return settings;
  }

  async getAccessToken(): Promise<string | undefined> {
    return this.accessToken;
  }

  async saveAccessToken(token: string): Promise<void> {
    this.accessToken = token;
  }

  async clearAccessToken(): Promise<void> {
    this.accessToken = undefined;
  }
}

export const storage = new MemStorage();
