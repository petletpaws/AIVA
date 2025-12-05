import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import axios from "axios";
import { Resend } from 'resend';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import OpenAI from 'openai';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';
import * as Tesseract from 'tesseract.js';
import {
  enhancedExtractFromImage,
  applyCharacterCorrections,
  extractDates,
  extractAmounts,
  extractNames,
  cleanupProcessedFiles,
} from './ocr-utils';
import {
  opertoSettingsSchema,
  opertoAuthResponseSchema,
  opertoTasksResponseSchema,
  sendInvoiceRequestSchema,
  type OpertoTask,
  type OpertoSettings,
  type UploadedFile,
  type ExtractedInvoiceData,
  type MatchStatus,
} from "@shared/schema";

const OPERTO_BASE_URL = "https://teams-api.operto.com/api/v1";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
      'image/gif',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  }
});

const uploadedFiles: Map<string, UploadedFile> = new Map();

// Resend Integration - Get credentials from Replit connection
let connectionSettings: any;

async function getResendCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('Replit token not found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || !connectionSettings.settings?.api_key) {
    throw new Error('Resend not connected. Please configure the Resend integration.');
  }
  
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

async function getResendClient() {
  const { apiKey, fromEmail } = await getResendCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail: fromEmail || 'Operto Task Manager <onboarding@resend.dev>'
  };
}

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
      
      const { client: resend, fromEmail } = await getResendClient();

      const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        try {
          return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        } catch {
          return '—';
        }
      };

      const taskRows = invoiceData.tasks.map(task => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${task.TaskName}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${task.Property?.PropertyAbbreviation || '—'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${formatDate(task.CompleteConfirmedDate)}</td>
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
                  <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; color: #374151; border-bottom: 2px solid #e5e7eb;">Task Name</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; color: #374151; border-bottom: 2px solid #e5e7eb;">Property</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; font-size: 12px; color: #374151; border-bottom: 2px solid #e5e7eb;">Completed</th>
                  <th style="padding: 12px; text-align: right; font-weight: 600; font-size: 12px; color: #374151; border-bottom: 2px solid #e5e7eb;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${taskRows}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="padding: 16px 12px; text-align: right; font-weight: 600; font-size: 16px; color: #111827;">Total:</td>
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

      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: [invoiceData.recipientEmail],
        subject: `Invoice for ${invoiceData.staffName} - ${invoiceData.tasks.length} Tasks`,
        html: emailHtml,
      });

      if (error) {
        throw new Error(error.message);
      }

      res.json({ 
        success: true, 
        message: `Invoice sent to ${invoiceData.recipientEmail}`,
        emailId: data?.id
      });
    } catch (error: any) {
      console.error("Invoice send error:", error.message);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          error: "Invalid invoice data",
          details: error.errors 
        });
      }

      res.status(500).json({ 
        error: error.message || "Failed to send invoice. Please try again." 
      });
    }
  });

  // File upload endpoint
  app.post("/api/files/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
      
      const uploadedFile: UploadedFile = {
        id: fileId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date().toISOString(),
        extractedData: null,
        matchStatus: 'pending',
        matchedStaffName: null,
        matchDetails: null,
      };

      uploadedFiles.set(fileId, uploadedFile);
      res.json(uploadedFile);
    } catch (error: any) {
      console.error("File upload error:", error);
      res.status(500).json({ error: error.message || "Upload failed" });
    }
  });

  // Process file with AI
  app.post("/api/files/:fileId/process", async (req, res) => {
    try {
      const { fileId } = req.params;
      const { tasks } = req.body as { tasks: OpertoTask[] };

      const uploadedFile = uploadedFiles.get(fileId);
      if (!uploadedFile) {
        return res.status(404).json({ error: "File not found" });
      }

      const filePath = path.join(uploadDir, uploadedFile.filename);
      
      // Extract text from file based on type
      let textContent = '';
      
      // Check if handwritten mode is requested
      const isHandwritten = req.body.isHandwritten === true || req.body.isHandwritten === 'true';
      
      // Enhanced extraction results for structured data
      let enhancedResults: {
        dates: { dateStr: string; isoDate: string; confidence: number }[];
        amounts: { amount: number; original: string; confidence: number }[];
        names: { name: string; type: 'staff' | 'property' | 'unknown'; confidence: number }[];
        ocrConfidence: number;
      } | null = null;
      
      if (uploadedFile.mimeType === 'application/pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const parser = new PDFParse({ data: dataBuffer });
        const pdfData = await parser.getText();
        textContent = pdfData.text;
        await parser.destroy();
        
        // Apply character corrections to PDF text
        textContent = applyCharacterCorrections(textContent);
        
        // Extract structured data from corrected text
        enhancedResults = {
          dates: extractDates(textContent),
          amounts: extractAmounts(textContent),
          names: extractNames(textContent),
          ocrConfidence: 95, // PDF text is typically reliable
        };
      } else if (uploadedFile.mimeType.includes('word') || uploadedFile.mimeType === 'application/msword') {
        const result = await mammoth.extractRawText({ path: filePath });
        textContent = result.value;
        
        // Apply character corrections
        textContent = applyCharacterCorrections(textContent);
        
        enhancedResults = {
          dates: extractDates(textContent),
          amounts: extractAmounts(textContent),
          names: extractNames(textContent),
          ocrConfidence: 95,
        };
      } else if (uploadedFile.mimeType.startsWith('image/')) {
        // Use enhanced OCR with preprocessing and character correction
        const ocrResult = await enhancedExtractFromImage(filePath, isHandwritten);
        textContent = ocrResult.correctedText;
        
        enhancedResults = {
          dates: ocrResult.dates,
          amounts: ocrResult.amounts,
          names: ocrResult.names,
          ocrConfidence: ocrResult.ocrConfidence,
        };
        
        console.log('Enhanced OCR Results:', {
          rawTextLength: ocrResult.rawText.length,
          correctedTextLength: ocrResult.correctedText.length,
          datesFound: ocrResult.dates.length,
          amountsFound: ocrResult.amounts.length,
          namesFound: ocrResult.names.length,
          confidence: ocrResult.ocrConfidence,
        });
      } else if (uploadedFile.mimeType === 'text/plain') {
        textContent = fs.readFileSync(filePath, 'utf-8');
        textContent = applyCharacterCorrections(textContent);
        
        enhancedResults = {
          dates: extractDates(textContent),
          amounts: extractAmounts(textContent),
          names: extractNames(textContent),
          ocrConfidence: 100,
        };
      }

      // Use OpenAI to extract invoice data, enhanced with pre-extracted structured data
      const extractedData = await extractInvoiceDataWithAI(textContent, enhancedResults);
      
      // Match against system invoices
      const matchResult = matchInvoiceWithTasks(extractedData, tasks);

      const updatedFile: UploadedFile = {
        ...uploadedFile,
        extractedData,
        matchStatus: matchResult.status,
        matchedStaffName: matchResult.matchedStaffName,
        matchDetails: matchResult.details,
      };

      uploadedFiles.set(fileId, updatedFile);
      res.json(updatedFile);
    } catch (error: any) {
      console.error("File processing error:", error);
      res.status(500).json({ error: error.message || "Processing failed" });
    }
  });

  // Delete file
  app.delete("/api/files/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      const uploadedFile = uploadedFiles.get(fileId);
      
      if (!uploadedFile) {
        return res.status(404).json({ error: "File not found" });
      }

      const filePath = path.join(uploadDir, uploadedFile.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      uploadedFiles.delete(fileId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("File delete error:", error);
      res.status(500).json({ error: error.message || "Delete failed" });
    }
  });

  // Get all uploaded files
  app.get("/api/files", async (_req, res) => {
    try {
      const files = Array.from(uploadedFiles.values());
      res.json(files);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// AI-powered invoice data extraction with enhanced OCR results
async function extractInvoiceDataWithAI(
  text: string,
  enhancedResults?: {
    dates: { dateStr: string; isoDate: string; confidence: number }[];
    amounts: { amount: number; original: string; confidence: number }[];
    names: { name: string; type: 'staff' | 'property' | 'unknown'; confidence: number }[];
    ocrConfidence: number;
  } | null
): Promise<ExtractedInvoiceData> {
  try {
    // Build hints from enhanced OCR results
    let extractionHints = '';
    if (enhancedResults) {
      const hints: string[] = [];
      
      if (enhancedResults.dates.length > 0) {
        const topDates = enhancedResults.dates.slice(0, 3);
        hints.push(`Detected dates: ${topDates.map(d => `${d.isoDate} (from "${d.dateStr}")`).join(', ')}`);
      }
      
      if (enhancedResults.amounts.length > 0) {
        const topAmounts = enhancedResults.amounts.slice(0, 5);
        hints.push(`Detected amounts: ${topAmounts.map(a => `$${a.amount} (from "${a.original}")`).join(', ')}`);
      }
      
      if (enhancedResults.names.length > 0) {
        const staffNames = enhancedResults.names.filter(n => n.type === 'staff').slice(0, 3);
        const propertyNames = enhancedResults.names.filter(n => n.type === 'property').slice(0, 3);
        
        if (staffNames.length > 0) {
          hints.push(`Possible staff names: ${staffNames.map(n => n.name).join(', ')}`);
        }
        if (propertyNames.length > 0) {
          hints.push(`Possible property/address: ${propertyNames.map(n => n.name).join(', ')}`);
        }
      }
      
      if (hints.length > 0) {
        extractionHints = `\n\nPRE-EXTRACTED DATA HINTS (use these to help validate your extraction):\n${hints.join('\n')}`;
      }
    }
    
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OpenAI API key not configured, using enhanced basic extraction");
      return enhancedBasicExtraction(text, enhancedResults);
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are an invoice data extraction expert specializing in handwritten and scanned documents. Extract the following information from the invoice text:
- staffName: The name of the contractor/staff member (look for names near "From:", "By:", "Contractor:", or at the top of the document)
- totalAmount: The total amount/sum on the invoice (as a number, without currency symbols). Look for the largest amount or amounts near "Total", "Sum", "Amount Due"
- date: The invoice date in YYYY-MM-DD format. Handle various date formats:
  * d/m/yy or dd/mm/yy (European): 7/9/25 means 2025-09-07
  * d.m.yyyy: 02.09.2025 means 2025-09-02
  * d/m without year: 25/8 means current year, August 25
  * Written: "Sep 7, 2025" or "7 Sep 2025"
- propertyName: Any property name, unit number, or address mentioned
- lineItems: Array of individual line items with description and amount

Common OCR misreads to consider:
- "S" or "s" may be "5" in numbers
- "O" or "o" may be "0" in numbers
- "l" or "I" or "|" may be "1" in numbers
- "B" may be "8" in numbers

Respond with JSON in this exact format:
{
  "staffName": "string or null",
  "totalAmount": "number or null",
  "date": "string or null (YYYY-MM-DD format)",
  "propertyName": "string or null",
  "lineItems": [{"description": "string", "amount": "number or null"}]
}`
        },
        {
          role: "user",
          content: (text || "No text content available") + extractionHints
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // Use AI result but fall back to enhanced extraction if AI returns null
    let staffName = result.staffName || null;
    let totalAmount = typeof result.totalAmount === 'number' ? result.totalAmount : null;
    let date = result.date || null;
    let propertyName = result.propertyName || null;
    
    // Fill in from enhanced results if AI missed them
    if (enhancedResults) {
      if (!staffName && enhancedResults.names.length > 0) {
        const staffCandidate = enhancedResults.names.find(n => n.type === 'staff');
        if (staffCandidate) staffName = staffCandidate.name;
      }
      
      if (totalAmount === null && enhancedResults.amounts.length > 0) {
        totalAmount = enhancedResults.amounts[0].amount;
      }
      
      if (!date && enhancedResults.dates.length > 0) {
        date = enhancedResults.dates[0].isoDate;
      }
      
      if (!propertyName && enhancedResults.names.length > 0) {
        const propCandidate = enhancedResults.names.find(n => n.type === 'property');
        if (propCandidate) propertyName = propCandidate.name;
      }
    }
    
    return {
      staffName,
      totalAmount,
      date,
      propertyName,
      lineItems: result.lineItems || [],
      rawText: text.substring(0, 500),
      rawTextFull: text,
    };
  } catch (error: any) {
    console.error("AI extraction error:", error);
    return enhancedBasicExtraction(text, enhancedResults);
  }
}

// Fallback basic text extraction (legacy)
function basicExtraction(text: string): ExtractedInvoiceData {
  const amountMatch = text.match(/\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
  const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
  
  return {
    staffName: null,
    totalAmount: amountMatch ? parseFloat(amountMatch[1].replace(',', '')) : null,
    date: dateMatch ? dateMatch[1] : null,
    propertyName: null,
    lineItems: [],
    rawText: text.substring(0, 500),
    rawTextFull: text,
  };
}

// Enhanced basic text extraction using pre-extracted OCR data
function enhancedBasicExtraction(
  text: string,
  enhancedResults?: {
    dates: { dateStr: string; isoDate: string; confidence: number }[];
    amounts: { amount: number; original: string; confidence: number }[];
    names: { name: string; type: 'staff' | 'property' | 'unknown'; confidence: number }[];
    ocrConfidence: number;
  } | null
): ExtractedInvoiceData {
  let staffName: string | null = null;
  let totalAmount: number | null = null;
  let date: string | null = null;
  let propertyName: string | null = null;
  
  if (enhancedResults) {
    // Get best staff name
    const staffCandidate = enhancedResults.names.find(n => n.type === 'staff');
    if (staffCandidate) staffName = staffCandidate.name;
    
    // Get largest/most confident amount
    if (enhancedResults.amounts.length > 0) {
      totalAmount = enhancedResults.amounts[0].amount;
    }
    
    // Get best date
    if (enhancedResults.dates.length > 0) {
      date = enhancedResults.dates[0].isoDate;
    }
    
    // Get property
    const propCandidate = enhancedResults.names.find(n => n.type === 'property');
    if (propCandidate) propertyName = propCandidate.name;
  } else {
    // Fallback to basic extraction
    const amountMatch = text.match(/\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
    const dateMatch = text.match(/(\d{1,2}[\/\-.\s]\d{1,2}[\/\-.\s]?\d{0,4})/);
    
    if (amountMatch) {
      totalAmount = parseFloat(amountMatch[1].replace(',', ''));
    }
    if (dateMatch) {
      date = dateMatch[1];
    }
  }
  
  return {
    staffName,
    totalAmount,
    date,
    propertyName,
    lineItems: [],
    rawText: text.substring(0, 500),
    rawTextFull: text,
  };
}

// Match extracted invoice data against system tasks
function matchInvoiceWithTasks(
  extractedData: ExtractedInvoiceData,
  tasks: OpertoTask[]
): { status: MatchStatus; matchedStaffName: string | null; details: string } {
  if (!extractedData || tasks.length === 0) {
    return { status: 'no_match', matchedStaffName: null, details: 'No data to match against' };
  }

  // Group tasks by staff
  const staffGroups: Record<string, { tasks: OpertoTask[]; total: number }> = {};
  
  for (const task of tasks) {
    if (task.Staff && task.Staff.length > 0) {
      for (const staff of task.Staff) {
        if (!staffGroups[staff.Name]) {
          staffGroups[staff.Name] = { tasks: [], total: 0 };
        }
        staffGroups[staff.Name].tasks.push(task);
        staffGroups[staff.Name].total += task.Amount || 0;
      }
    }
  }

  // Try to match by staff name first
  let bestMatch: { staffName: string; score: number; total: number } | null = null;
  
  if (extractedData.staffName) {
    const extractedName = extractedData.staffName.toLowerCase();
    
    for (const [staffName, data] of Object.entries(staffGroups)) {
      const nameLower = staffName.toLowerCase();
      
      // Exact match
      if (nameLower === extractedName) {
        bestMatch = { staffName, score: 100, total: data.total };
        break;
      }
      
      // Partial match (contains)
      if (nameLower.includes(extractedName) || extractedName.includes(nameLower)) {
        const score = 70;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { staffName, score, total: data.total };
        }
      }
      
      // Check individual name parts
      const extractedParts = extractedName.split(/\s+/);
      const nameParts = nameLower.split(/\s+/);
      const matchingParts = extractedParts.filter(p => nameParts.some(np => np.includes(p) || p.includes(np)));
      
      if (matchingParts.length > 0) {
        const score = (matchingParts.length / Math.max(extractedParts.length, nameParts.length)) * 60;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { staffName, score, total: data.total };
        }
      }
    }
  }

  // Determine match status
  if (bestMatch) {
    const amountMatch = extractedData.totalAmount !== null && 
      Math.abs(bestMatch.total - extractedData.totalAmount) < 0.01;
    
    if (bestMatch.score >= 70 && amountMatch) {
      return {
        status: 'full_match',
        matchedStaffName: bestMatch.staffName,
        details: `Matched to ${bestMatch.staffName} with amount $${bestMatch.total.toFixed(2)}`,
      };
    } else if (bestMatch.score >= 50) {
      const amountDiff = extractedData.totalAmount !== null 
        ? `(Invoice: $${extractedData.totalAmount.toFixed(2)}, System: $${bestMatch.total.toFixed(2)})`
        : '';
      return {
        status: 'partial_match',
        matchedStaffName: bestMatch.staffName,
        details: `Possible match to ${bestMatch.staffName} ${amountDiff}. Please verify.`,
      };
    }
  }

  // Try to match by amount only
  if (extractedData.totalAmount !== null) {
    for (const [staffName, data] of Object.entries(staffGroups)) {
      if (Math.abs(data.total - extractedData.totalAmount) < 0.01) {
        return {
          status: 'partial_match',
          matchedStaffName: staffName,
          details: `Amount matches ${staffName}'s total ($${data.total.toFixed(2)}). Staff name could not be verified.`,
        };
      }
    }
  }

  return {
    status: 'no_match',
    matchedStaffName: null,
    details: 'No matching staff or amount found in system invoices.',
  };
}
