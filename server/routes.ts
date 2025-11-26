import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import axios from "axios";
import {
  opertoSettingsSchema,
  opertoAuthResponseSchema,
  opertoTasksResponseSchema,
  sendInvoiceRequestSchema,
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

  app.post("/api/invoices/send", async (req, res) => {
    try {
      const invoiceData = sendInvoiceRequestSchema.parse(req.body);
      
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        return res.status(500).json({ 
          error: "Email service not configured. Please add RESEND_API_KEY to your environment." 
        });
      }

      const taskRows = invoiceData.tasks.map(task => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-size: 12px;">${task.TaskID}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${task.TaskName}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${task.Property?.PropertyAbbreviation || '—'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${task.CompleteConfirmedDate ? 'Completed' : 'Pending'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">${task.Amount != null ? `$${task.Amount.toFixed(2)}` : '—'}</td>
        </tr>
      `).join('');

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Invoice - ${invoiceData.staffName}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; background-color: #f9fafb;">
          <div style="background: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px;">
              <div>
                <h1 style="margin: 0; font-size: 28px; color: #111827;">INVOICE</h1>
                <p style="margin: 8px 0 0 0; color: #6b7280; font-size: 14px;">Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <div style="text-align: right;">
                <p style="margin: 0; font-weight: 600; color: #111827;">${invoiceData.staffName}</p>
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
              <thead>
                <tr style="background-color: #f9fafb;">
                  <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; color: #374151; border-bottom: 2px solid #e5e7eb;">Task ID</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; color: #374151; border-bottom: 2px solid #e5e7eb;">Task Name</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; color: #374151; border-bottom: 2px solid #e5e7eb;">Property</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; color: #374151; border-bottom: 2px solid #e5e7eb;">Status</th>
                  <th style="padding: 12px; text-align: right; font-weight: 600; font-size: 12px; color: #374151; border-bottom: 2px solid #e5e7eb;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${taskRows}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" style="padding: 16px 12px; text-align: right; font-weight: 600; font-size: 16px; color: #111827;">Total:</td>
                  <td style="padding: 16px 12px; text-align: right; font-weight: 700; font-size: 20px; color: #111827;">$${invoiceData.totalAmount.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>

            <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">Generated by Operto Task Manager</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const response = await axios.post(
        'https://api.resend.com/emails',
        {
          from: 'Operto Task Manager <onboarding@resend.dev>',
          to: [invoiceData.recipientEmail],
          subject: `Invoice for ${invoiceData.staffName} - ${invoiceData.tasks.length} Tasks`,
          html: emailHtml,
        },
        {
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      res.json({ 
        success: true, 
        message: `Invoice sent to ${invoiceData.recipientEmail}`,
        emailId: response.data.id
      });
    } catch (error: any) {
      console.error("Invoice send error:", error.response?.data || error.message);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          error: "Invalid invoice data",
          details: error.errors 
        });
      }

      res.status(500).json({ 
        error: error.response?.data?.message || "Failed to send invoice. Please try again." 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
