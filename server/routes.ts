import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import axios from "axios";
import {
  opertoSettingsSchema,
  opertoAuthResponseSchema,
  opertoTasksResponseSchema,
  type OpertoTask,
  type OpertoSettings,
} from "@shared/schema";

const OPERTO_BASE_URL = "https://teams-api.operto.com/api/v1";

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/settings", async (req, res) => {
    try {
      const settings = opertoSettingsSchema.parse(req.body);
      const savedSettings = await storage.saveSettings(settings);
      await storage.clearAccessToken();
      res.json(savedSettings);
    } catch (error: any) {
      console.error("Settings save error:", error);
      res.status(400).json({ 
        error: "Invalid settings", 
        details: error.message 
      });
    }
  });

  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      if (!settings) {
        return res.status(404).json({ error: "Settings not configured" });
      }
      res.json(settings);
    } catch (error: any) {
      console.error("Settings fetch error:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.post("/api/auth/login", async (_req, res) => {
    try {
      const settings = await storage.getSettings();
      if (!settings) {
        return res.status(400).json({ 
          error: "Invalid API credentials. Please update settings." 
        });
      }

      const response = await axios.post(
        `${OPERTO_BASE_URL}/oauth/login`,
        {
          API_Key: settings.apiKey,
          API_Value: settings.apiValue,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const authData = opertoAuthResponseSchema.parse(response.data);
      await storage.saveAccessToken(authData.Access_Token.token);

      res.json({ 
        success: true, 
        message: "Authentication successful" 
      });
    } catch (error: any) {
      console.error("Auth error:", error.response?.data || error.message);
      await storage.clearAccessToken();
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        return res.status(401).json({ 
          error: "Invalid API credentials. Please update settings." 
        });
      }
      
      res.status(500).json({ 
        error: "Authentication failed. Please try again." 
      });
    }
  });

  app.get("/api/tasks", async (req, res) => {
    try {
      let accessToken = await storage.getAccessToken();
      const settings = await storage.getSettings();

      if (!settings) {
        return res.status(400).json({ 
          error: "Invalid API credentials. Please update settings." 
        });
      }

      if (!accessToken) {
        try {
          const authResponse = await axios.post(
            `${OPERTO_BASE_URL}/oauth/login`,
            {
              API_Key: settings.apiKey,
              API_Value: settings.apiValue,
            }
          );
          const authData = opertoAuthResponseSchema.parse(authResponse.data);
          accessToken = authData.Access_Token.token;
          await storage.saveAccessToken(accessToken);
        } catch (authError: any) {
          console.error("Auto-auth error:", authError.response?.data || authError.message);
          return res.status(401).json({ 
            error: "Invalid API credentials. Please update settings." 
          });
        }
      }

      const queryParams: any = {
        per_page: settings.perPage || 100,
      };

      if (settings.completed !== undefined && settings.completed !== "") {
        queryParams.Completed = settings.completed;
      }
      if (settings.taskStartDate) {
        queryParams.TaskStartDate = settings.taskStartDate;
      }
      if (settings.taskEndDate) {
        queryParams.TaskEndDate = settings.taskEndDate;
      }

      const allTasks: OpertoTask[] = [];
      let currentPage = 1;
      let hasMore = true;

      while (hasMore) {
        try {
          const response = await axios.get(`${OPERTO_BASE_URL}/tasks`, {
            headers: {
              Authorization: `VRS ${accessToken}`,
              "Content-Type": "application/json",
            },
            params: {
              ...queryParams,
              page: currentPage,
            },
          });

          console.log("Operto API Response:", JSON.stringify(response.data, null, 2));

          const tasksData = opertoTasksResponseSchema.parse(response.data);
          allTasks.push(...tasksData.data);

          hasMore = tasksData.has_more;
          if (hasMore && tasksData.next_page) {
            currentPage = tasksData.next_page;
          } else {
            hasMore = false;
          }
        } catch (pageError: any) {
          if (pageError.response?.status === 401) {
            await storage.clearAccessToken();
            return res.status(401).json({ 
              error: "Session expired. Please reconnect." 
            });
          }
          throw pageError;
        }
      }

      res.json({ tasks: allTasks, total: allTasks.length });
    } catch (error: any) {
      console.error("Task fetch error:", error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        await storage.clearAccessToken();
        return res.status(401).json({ 
          error: "Invalid API credentials. Please update settings." 
        });
      }

      res.status(500).json({ 
        error: "Error fetching tasks. Please try again.",
        details: error.message 
      });
    }
  });

  app.post("/api/auth/logout", async (_req, res) => {
    try {
      await storage.clearAccessToken();
      res.json({ success: true, message: "Logged out successfully" });
    } catch (error: any) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
