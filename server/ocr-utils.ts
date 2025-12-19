import sharp from 'sharp';
import * as Tesseract from 'tesseract.js';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Confidence threshold below which we use Vision API fallback
const VISION_FALLBACK_THRESHOLD = 60;

// Common OCR misread corrections
const CHARACTER_CORRECTIONS: Record<string, { pattern: RegExp; context: 'numeric' | 'alpha' | 'any' }[]> = {
  '0': [
    { pattern: /[oO]/g, context: 'numeric' },
    { pattern: /[Oo]/g, context: 'numeric' },
  ],
  '1': [
    { pattern: /[lI|]/g, context: 'numeric' },
    { pattern: /\//g, context: 'numeric' },
  ],
  '2': [
    { pattern: /[zZ]/g, context: 'numeric' },
  ],
  '5': [
    { pattern: /[sS]/g, context: 'numeric' },
  ],
  '6': [
    { pattern: /[bG]/g, context: 'numeric' },
  ],
  '8': [
    { pattern: /[B]/g, context: 'numeric' },
    { pattern: /[S]/g, context: 'numeric' },
  ],
  '9': [
    { pattern: /[g]/g, context: 'numeric' },
  ],
  'S': [
    { pattern: /[5]/g, context: 'alpha' },
  ],
  'I': [
    { pattern: /[1|]/g, context: 'alpha' },
  ],
  'O': [
    { pattern: /[0]/g, context: 'alpha' },
  ],
  'B': [
    { pattern: /[8]/g, context: 'alpha' },
  ],
};

// Date format patterns with their parsing functions
const DATE_PATTERNS: { pattern: RegExp; parse: (match: RegExpMatchArray) => { day: number; month: number; year: number } | null }[] = [
  // dd.mm.yyyy or dd/mm/yyyy or dd-mm-yyyy (European format)
  {
    pattern: /\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})\b/g,
    parse: (m) => ({ day: parseInt(m[1]), month: parseInt(m[2]), year: parseInt(m[3]) })
  },
  // dd.mm.yy or dd/mm/yy or dd-mm-yy (European with 2-digit year)
  {
    pattern: /\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2})\b/g,
    parse: (m) => ({ day: parseInt(m[1]), month: parseInt(m[2]), year: normalizeYear(parseInt(m[3])) })
  },
  // d/m (no year - assume current year)
  {
    pattern: /\b(\d{1,2})[.\/-](\d{1,2})\b(?![.\/-]\d)/g,
    parse: (m) => {
      const day = parseInt(m[1]);
      const month = parseInt(m[2]);
      if (day > 31 || month > 12) return null;
      return { day, month, year: new Date().getFullYear() };
    }
  },
  // yyyy-mm-dd (ISO format)
  {
    pattern: /\b(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})\b/g,
    parse: (m) => ({ day: parseInt(m[3]), month: parseInt(m[2]), year: parseInt(m[1]) })
  },
  // mm/dd/yyyy (US format)
  {
    pattern: /\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})\b/g,
    parse: (m) => {
      const first = parseInt(m[1]);
      const second = parseInt(m[2]);
      // If first > 12, it's likely dd/mm format
      if (first > 12) {
        return { day: first, month: second, year: parseInt(m[3]) };
      }
      // Ambiguous - try to infer
      return { day: second, month: first, year: parseInt(m[3]) };
    }
  },
  // Written dates like "7 Sep 2025" or "Sep 7, 2025"
  {
    pattern: /\b(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,.\s]+(\d{2,4})\b/gi,
    parse: (m) => ({
      day: parseInt(m[1]),
      month: getMonthNumber(m[2]),
      year: normalizeYear(parseInt(m[3]))
    })
  },
  {
    pattern: /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,.\s]+(\d{1,2})[,.\s]+(\d{2,4})\b/gi,
    parse: (m) => ({
      day: parseInt(m[2]),
      month: getMonthNumber(m[1]),
      year: normalizeYear(parseInt(m[3]))
    })
  },
];

function getMonthNumber(monthStr: string): number {
  const months: Record<string, number> = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
  };
  return months[monthStr.toLowerCase().substring(0, 3)] || 0;
}

function normalizeYear(year: number): number {
  if (year >= 100) return year;
  // 2-digit year: assume 20xx for years 00-50, 19xx for 51-99
  return year <= 50 ? 2000 + year : 1900 + year;
}

// Preprocess image for better OCR accuracy
export async function preprocessImage(inputPath: string): Promise<string> {
  const outputPath = inputPath.replace(/\.[^.]+$/, '_processed.png');
  
  try {
    // Read image and get metadata
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // Calculate upscale factor for small images
    const minDimension = Math.min(metadata.width || 1000, metadata.height || 1000);
    const scaleFactor = minDimension < 1000 ? Math.ceil(1500 / minDimension) : 1;
    
    await image
      // Upscale small images for better OCR
      .resize(
        (metadata.width || 1000) * scaleFactor,
        (metadata.height || 1000) * scaleFactor,
        { kernel: 'lanczos3' }
      )
      // Convert to grayscale
      .grayscale()
      // Increase contrast
      .normalise()
      // Sharpen for better text edges
      .sharpen({ sigma: 1.5 })
      // Apply threshold for cleaner text (adaptive binarization)
      .threshold(128)
      // Output as PNG for lossless quality
      .png()
      .toFile(outputPath);
    
    return outputPath;
  } catch (error) {
    console.error('Image preprocessing failed:', error);
    return inputPath; // Return original if preprocessing fails
  }
}

// Alternative preprocessing for handwritten/cursive text
export async function preprocessHandwritten(inputPath: string): Promise<string> {
  const outputPath = inputPath.replace(/\.[^.]+$/, '_handwritten.png');
  
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // More aggressive upscaling for handwritten text
    const minDimension = Math.min(metadata.width || 1000, metadata.height || 1000);
    const scaleFactor = minDimension < 1500 ? Math.ceil(2000 / minDimension) : 1;
    
    await image
      .resize(
        (metadata.width || 1000) * scaleFactor,
        (metadata.height || 1000) * scaleFactor,
        { kernel: 'lanczos3' }
      )
      .grayscale()
      // Higher contrast for handwritten text
      .linear(1.5, -(128 * 0.5))
      .normalise()
      // Gentler sharpening to preserve curves
      .sharpen({ sigma: 0.8 })
      // Lower threshold for handwritten text (captures lighter strokes)
      .threshold(100)
      .png()
      .toFile(outputPath);
    
    return outputPath;
  } catch (error) {
    console.error('Handwritten preprocessing failed:', error);
    return inputPath;
  }
}

// Enhanced Tesseract OCR with better configuration
export async function performOCR(imagePath: string, isHandwritten: boolean = false): Promise<{
  text: string;
  confidence: number;
  words: Array<{ text: string; confidence: number }>;
}> {
  const tesseractLib = (Tesseract as any).default || Tesseract;
  
  // Preprocess image
  const processedPath = isHandwritten 
    ? await preprocessHandwritten(imagePath)
    : await preprocessImage(imagePath);
  
  try {
    // Create worker with specific configuration
    const worker = await tesseractLib.createWorker('eng', 1, {
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    // Configure for best accuracy
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO, // Automatic page segmentation
      preserve_interword_spaces: '1',
      tessedit_char_whitelist: '', // Allow all characters
    });
    
    const result = await worker.recognize(processedPath);
    
    await worker.terminate();
    
    // Clean up processed file
    if (processedPath !== imagePath && fs.existsSync(processedPath)) {
      fs.unlinkSync(processedPath);
    }
    
    return {
      text: result.data.text,
      confidence: result.data.confidence,
      words: result.data.words?.map((w: any) => ({
        text: w.text,
        confidence: w.confidence
      })) || []
    };
  } catch (error) {
    console.error('OCR failed:', error);
    
    // Clean up processed file on error
    if (processedPath !== imagePath && fs.existsSync(processedPath)) {
      fs.unlinkSync(processedPath);
    }
    
    throw error;
  }
}

// OpenAI Vision API for text extraction - used as fallback for low-confidence Tesseract results
export async function extractTextWithVision(imagePath: string): Promise<{
  text: string;
  confidence: number;
}> {
  try {
    // Read image and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Determine MIME type from extension
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 
                     ext === '.gif' ? 'image/gif' : 
                     ext === '.webp' ? 'image/webp' : 'image/jpeg';
    
    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are an expert OCR system. Extract ALL text visible in the image exactly as it appears.
Preserve:
- Line breaks and spacing
- Numbers, dates, and amounts exactly as written
- Names, addresses, and any identifiable information
- Any handwritten notes or annotations

Output ONLY the extracted text, nothing else. Do not add any explanations or formatting.`
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            },
            {
              type: "text",
              text: "Extract all text from this image."
            }
          ],
        },
      ],
    });

    const extractedText = response.choices[0].message.content || '';
    
    console.log('Vision API extraction successful, text length:', extractedText.length);
    
    return {
      text: extractedText,
      confidence: 95 // Vision API generally has high accuracy
    };
  } catch (error) {
    console.error('Vision API extraction failed:', error);
    throw error;
  }
}

// Helper: Check if a token is predominantly numeric (more digits than letters)
function isNumericContext(token: string): boolean {
  const digits = (token.match(/\d/g) || []).length;
  const letters = (token.match(/[a-zA-Z]/g) || []).length;
  // Token is numeric if it has digits AND more digits than letters
  return digits > 0 && digits >= letters;
}

// Helper: Fix characters within a clearly numeric token only
function fixNumericToken(token: string): string {
  // Only apply fixes if the token is predominantly numeric
  if (!isNumericContext(token)) return token;
  
  let fixed = token;
  fixed = fixed.replace(/[oO]/g, '0');
  fixed = fixed.replace(/[lI|]/g, '1');
  // Only convert S to 5 if surrounded by digits or at boundaries of numeric sequence
  fixed = fixed.replace(/(?<=\d)[sS](?=\d)/g, '5');
  fixed = fixed.replace(/^[sS](?=\d)/g, '5');
  fixed = fixed.replace(/(?<=\d)[sS]$/g, '5');
  return fixed;
}

// Apply OCR character corrections ONLY in clearly monetary/numeric contexts
// This preserves words like "Staff", "Contractor", etc.
export function applyCharacterCorrections(text: string): string {
  let correctedText = text;
  
  // Fix monetary amounts: $1oo.oo -> $100.00
  // Only fix when there's a clear $ symbol or the pattern looks like money
  correctedText = correctedText.replace(/\$\s*([0-9oOlI|,]+(?:\.[0-9oOlI|]{1,2})?)/g, (match, amount) => {
    let fixed = amount;
    fixed = fixed.replace(/[oO]/g, '0');
    fixed = fixed.replace(/[lI|]/g, '1');
    return '$' + fixed;
  });
  
  // Fix S followed immediately by digits (like S100 -> $100) - but NOT "Staff" or "Sep"
  correctedText = correctedText.replace(/\bS(\d{2,}(?:\.\d{1,2})?)\b/g, (match, num) => {
    return '$' + num;
  });
  
  // Fix dates - be careful to only fix within the date pattern itself
  correctedText = correctedText.replace(/\b(\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?\b/g, (match, p1, p2, p3) => {
    // Only fix if the components look numeric (contain at least one digit)
    if (!/\d/.test(p1) || !/\d/.test(p2)) return match;
    
    let day = fixNumericToken(p1);
    let month = fixNumericToken(p2);
    let year = p3 ? fixNumericToken(p3) : '';
    
    const sep = match.includes('.') ? '.' : match.includes('-') ? '-' : '/';
    return year ? `${day}${sep}${month}${sep}${year}` : `${day}${sep}${month}`;
  });
  
  // Fix purely numeric sequences (like phone numbers, IDs) but NOT mixed alphanumeric
  // Pattern: sequences that are predominantly digits with occasional letter-misreads
  correctedText = correctedText.replace(/\b(\d+[oOlI|sS]*\d*|\d*[oOlI|sS]+\d+)\b/g, (match) => {
    // Count digits vs letters
    const digitCount = (match.match(/\d/g) || []).length;
    const letterCount = (match.match(/[a-zA-Z]/g) || []).length;
    
    // Only fix if clearly numeric (at least 2 digits and more digits than letters)
    if (digitCount < 2 || digitCount <= letterCount) return match;
    
    return fixNumericToken(match);
  });
  
  return correctedText;
}

// Parse dates from text with multiple format support
export function extractDates(text: string): { dateStr: string; isoDate: string; confidence: number }[] {
  const correctedText = applyCharacterCorrections(text);
  const dates: { dateStr: string; isoDate: string; confidence: number }[] = [];
  const seen = new Set<string>();
  
  // Add additional date patterns for better .txt coverage
  const additionalPatterns = [
    // ISO format: 2025-09-07 or 2025/09/07
    { pattern: /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/g, parse: (m: RegExpExecArray) => ({ year: parseInt(m[1]), month: parseInt(m[2]), day: parseInt(m[3]) }) },
    // Month name: September 7, 2025 or Sep 7 2025
    { pattern: /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/gi, parse: (m: RegExpExecArray) => {
      const monthNames: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
      const month = monthNames[m[0].substring(0, 3).toLowerCase()] || 0;
      return { year: parseInt(m[2]), month, day: parseInt(m[1]) };
    } },
  ];
  
  const allPatterns = [...DATE_PATTERNS, ...additionalPatterns];
  
  for (const { pattern, parse } of allPatterns) {
    // Reset pattern lastIndex
    pattern.lastIndex = 0;
    
    let match;
    while ((match = pattern.exec(correctedText)) !== null) {
      try {
        const parsed = parse(match);
        if (!parsed) continue;
        
        const { day, month, year } = parsed;
        
        // Validate date components
        if (month < 1 || month > 12) continue;
        if (day < 1 || day > 31) continue;
        if (year < 1900 || year > 2100) continue;
        
        // Create ISO date
        const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Skip duplicates
        if (seen.has(isoDate)) continue;
        seen.add(isoDate);
        
        // Validate it's a real date
        const dateObj = new Date(isoDate);
        if (isNaN(dateObj.getTime())) continue;
        
        // Calculate confidence based on format clarity
        let confidence = 70;
        if (match[0].length >= 8) confidence += 15; // Full date format
        if (year >= 2020 && year <= 2030) confidence += 10; // Recent year
        if (day <= 31 && month <= 12) confidence += 5; // Valid ranges
        
        dates.push({
          dateStr: match[0],
          isoDate,
          confidence: Math.min(confidence, 100)
        });
      } catch (e) {
        // Skip invalid dates
      }
    }
  }
  
  // Sort by confidence
  return dates.sort((a, b) => b.confidence - a.confidence);
}

// Extract amounts from text with comprehensive pattern coverage
export function extractAmounts(text: string): { amount: number; original: string; confidence: number }[] {
  const correctedText = applyCharacterCorrections(text);
  const amounts: { amount: number; original: string; confidence: number }[] = [];
  
  // Comprehensive pattern for money amounts with better coverage
  const amountPatterns = [
    // Label-based amounts: Total: $123 or Amount: 123.45 or Sum: 100.50
    /(?:total|amount|sum|due|pay|price|cost|fee|charge)[:\s]+\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi,
    // Currency symbol first: $1,234.56 or $ 1234.56
    /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g,
    // Decimal amounts: 1234.56 or 1,234.56
    /\b(\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})\b/g,
    // Currency code amounts: USD 123 or £ 50
    /(?:USD|AUD|GBP|EUR|£|\$)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi,
    // Large round numbers likely to be amounts: 1000, 5000, 10000
    /\b(\d{4,}(?:,\d{3})*(?:\.\d{2})?)\b/g,
  ];
  
  const seen = new Set<string>();
  
  for (const pattern of amountPatterns) {
    pattern.lastIndex = 0;
    let match;
    
    while ((match = pattern.exec(correctedText)) !== null) {
      const numStr = (match[1] || match[0]).replace(/[$,£€USD AUDGBPEURa-z]/gi, '').trim();
      const amount = parseFloat(numStr);
      
      if (isNaN(amount) || amount <= 0) continue;
      
      // Deduplicate by amount value
      const key = amount.toFixed(2);
      if (seen.has(key)) continue;
      seen.add(key);
      
      // Calculate confidence
      let confidence = 50;
      if (match[0].match(/^[^\d]*\d/)) confidence += 20; // Has label prefix
      if (match[0].includes('$') || match[0].includes('£') || match[0].includes('€')) confidence += 25;
      if (/total|amount|sum|due|pay|price|cost|fee|charge/i.test(match[0])) confidence += 20;
      if (match[0].includes('.')) confidence += 5;
      if (amount >= 100) confidence += 5; // Likely to be real amount
      
      amounts.push({
        amount,
        original: match[0].trim(),
        confidence: Math.min(confidence, 100)
      });
    }
  }
  
  // Sort by confidence, then by amount (larger amounts first)
  return amounts.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.amount - a.amount;
  });
}

// Extract all data from text for comprehensive representation
export function extractAllData(text: string): {
  dates: { dateStr: string; isoDate: string; confidence: number }[];
  amounts: { amount: number; original: string; confidence: number }[];
  names: { name: string; type: 'staff' | 'property' | 'unknown'; confidence: number }[];
  phoneNumbers: { number: string; confidence: number }[];
  emails: { email: string; confidence: number }[];
  addresses: { address: string; confidence: number }[];
  allFieldsFound: Record<string, unknown>;
} {
  const dates = extractDates(text);
  const amounts = extractAmounts(text);
  const names = extractNames(text);
  
  // Extract phone numbers
  const phoneNumbers: { number: string; confidence: number }[] = [];
  const phonePattern = /\b(?:\+?1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g;
  let phoneMatch;
  const phoneSeen = new Set<string>();
  while ((phoneMatch = phonePattern.exec(text)) !== null) {
    const normalized = phoneMatch[0].replace(/[^\d]/g, '');
    if (!phoneSeen.has(normalized)) {
      phoneSeen.add(normalized);
      phoneNumbers.push({
        number: phoneMatch[0],
        confidence: 90
      });
    }
  }
  
  // Extract emails
  const emails: { email: string; confidence: number }[] = [];
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  let emailMatch;
  const emailSeen = new Set<string>();
  while ((emailMatch = emailPattern.exec(text)) !== null) {
    if (!emailSeen.has(emailMatch[0])) {
      emailSeen.add(emailMatch[0]);
      emails.push({
        email: emailMatch[0],
        confidence: 95
      });
    }
  }
  
  // Extract addresses
  const addresses: { address: string; confidence: number }[] = [];
  const addressPattern = /(\d+\s+[A-Z][a-z]+(?:\s+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Blvd|Boulevard|Way|Ct|Court|Cres|Crescent|Plaza|Park|Terrace|Hall|Gate|Court|Square|Close)\.?)?(?:\s+[A-Z][a-z]+)*(?:\s+[A-Z]{2}\s*\d{5})?)/gi;
  let addressMatch;
  const addressSeen = new Set<string>();
  while ((addressMatch = addressPattern.exec(text)) !== null) {
    const addr = addressMatch[0].trim();
    if (!addressSeen.has(addr) && addr.length > 5) {
      addressSeen.add(addr);
      addresses.push({
        address: addr,
        confidence: 75
      });
    }
  }
  
  return {
    dates,
    amounts,
    names,
    phoneNumbers,
    emails,
    addresses,
    allFieldsFound: {
      datesCount: dates.length,
      amountsCount: amounts.length,
      namesCount: names.length,
      phoneNumbersCount: phoneNumbers.length,
      emailsCount: emails.length,
      addressesCount: addresses.length,
    }
  };
}

// Extract staff/property names - uses RAW text to preserve words like "Staff", "Contractor"
export function extractNames(text: string): { name: string; type: 'staff' | 'property' | 'unknown'; confidence: number }[] {
  // Use raw text directly - DO NOT apply character corrections here
  // Character corrections corrupt words like "Staff" -> "5taff"
  const names: { name: string; type: 'staff' | 'property' | 'unknown'; confidence: number }[] = [];
  
  // Expanded staff name patterns - cover many common invoice formats
  const staffPatterns = [
    // Explicit labels with name after colon/space
    /(?:staff|contractor|technician|cleaner|worker|employee|performed\s+by|submitted\s+by|completed\s+by|from|by|name|invoice\s+from)[:\s]+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/gi,
    // Mr./Mrs./Ms. followed by name
    /(?:Mr\.?|Mrs\.?|Ms\.?|Miss)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
    // Names at start of line after common labels
    /^(?:Staff|Contractor|Cleaner|Technician)[:\s]+(.+?)$/gim,
    // Two or three capitalized words (likely full name) - more specific pattern
    /\b([A-Z][a-z]{2,15}\s+[A-Z][a-z]{2,15}(?:\s+[A-Z][a-z]{2,15})?)\b/g,
  ];
  
  // Property/address patterns
  const propertyPatterns = [
    /(?:property|address|location|unit|apt|apartment|site)[:\s#]*([A-Z0-9][^\n,]{3,50})/gi,
    /(\d+\s+[A-Z][a-z]+(?:\s+(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Blvd|Boulevard|Way|Ct|Court|Cres|Crescent)\.?))/gi,
  ];
  
  // Common words to exclude (not names)
  const excludeWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'for', 'to', 'from', 'with', 'this', 'that',
    'total', 'amount', 'invoice', 'date', 'due', 'payment', 'paid', 'balance',
    'description', 'quantity', 'price', 'subtotal', 'tax', 'grand', 'thank', 'you',
    'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'cleaning', 'service', 'services', 'maintenance', 'repair', 'job', 'work',
    'please', 'note', 'notes', 'terms', 'conditions', 'unit'
  ]);
  
  const seen = new Set<string>();
  
  // Extract staff names
  for (const pattern of staffPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = (match[1] || match[0]).trim();
      const normalized = name.toLowerCase();
      
      // Skip if too short, too long, or already seen
      if (name.length < 3 || name.length > 50) continue;
      if (seen.has(normalized)) continue;
      
      // Skip common words and phrases
      const words = normalized.split(/\s+/);
      if (words.some(w => excludeWords.has(w))) continue;
      if (words.length === 1 && name.length < 4) continue; // Single short word
      
      // Skip if it looks like a date or number
      if (/^\d/.test(name) || /\d{4}/.test(name)) continue;
      
      seen.add(normalized);
      
      // Calculate confidence based on context clues
      let confidence = 50;
      
      // Higher confidence if preceded by explicit label
      if (/staff|contractor|technician|cleaner|worker|employee|performed|submitted|completed/i.test(match[0])) {
        confidence += 35;
      } else if (/from|by|name/i.test(match[0])) {
        confidence += 25;
      }
      
      // Higher confidence for proper two-word names (First Last)
      if (/^[A-Z][a-z]+\s+[A-Z][a-z]+$/.test(name)) {
        confidence += 15;
      }
      
      // Slight boost for title prefixes
      if (/Mr|Mrs|Ms|Miss/i.test(match[0])) {
        confidence += 10;
      }
      
      names.push({ name, type: 'staff', confidence: Math.min(confidence, 100) });
    }
  }
  
  // Extract property names
  for (const pattern of propertyPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = (match[1] || match[0]).trim();
      const normalized = name.toLowerCase();
      
      if (name.length < 3 || name.length > 100) continue;
      if (seen.has(normalized)) continue;
      
      seen.add(normalized);
      
      let confidence = 50;
      if (/property|address|location|site/i.test(match[0])) confidence += 25;
      if (/\d+/.test(name)) confidence += 10;
      if (/St|Street|Ave|Avenue|Rd|Road|Dr|Drive/i.test(name)) confidence += 15;
      
      names.push({ name, type: 'property', confidence: Math.min(confidence, 100) });
    }
  }
  
  return names.sort((a, b) => b.confidence - a.confidence);
}

// Main enhanced extraction function
export interface EnhancedExtractionResult {
  rawText: string;
  correctedText: string;
  dates: { dateStr: string; isoDate: string; confidence: number }[];
  amounts: { amount: number; original: string; confidence: number }[];
  names: { name: string; type: 'staff' | 'property' | 'unknown'; confidence: number }[];
  ocrConfidence: number;
}

export async function enhancedExtractFromImage(
  imagePath: string,
  isHandwritten: boolean = false
): Promise<EnhancedExtractionResult> {
  // First, try Tesseract OCR with preprocessing
  const ocrResult = await performOCR(imagePath, isHandwritten);
  
  let rawText = ocrResult.text;
  let finalConfidence = ocrResult.confidence;
  let usedVisionFallback = false;
  
  // If Tesseract confidence is below threshold, use Vision API as fallback
  if (ocrResult.confidence < VISION_FALLBACK_THRESHOLD) {
    console.log(`Tesseract confidence (${ocrResult.confidence}%) below threshold (${VISION_FALLBACK_THRESHOLD}%), using Vision API fallback...`);
    
    try {
      const visionResult = await extractTextWithVision(imagePath);
      
      // Use Vision result if it extracted meaningful text
      if (visionResult.text.trim().length > 0) {
        rawText = visionResult.text;
        finalConfidence = visionResult.confidence;
        usedVisionFallback = true;
        console.log('Vision API fallback successful, confidence:', visionResult.confidence);
      }
    } catch (visionError) {
      console.error('Vision API fallback failed, using Tesseract result:', visionError);
      // Continue with Tesseract result if Vision fails
    }
  }
  
  // Apply character corrections for numeric data only
  const correctedText = applyCharacterCorrections(rawText);
  
  // Extract structured data
  // Dates and amounts use corrected text (for numeric fixes)
  const dates = extractDates(correctedText);
  const amounts = extractAmounts(correctedText);
  // Names use RAW text to preserve words like "Staff", "Contractor"
  const names = extractNames(rawText);
  
  if (usedVisionFallback) {
    console.log('Final extraction used Vision API with corrected text length:', correctedText.length);
  }
  
  return {
    rawText,
    correctedText,
    dates,
    amounts,
    names,
    ocrConfidence: finalConfidence
  };
}

// Cleanup temporary files
export function cleanupProcessedFiles(directory: string): void {
  try {
    const files = fs.readdirSync(directory);
    for (const file of files) {
      if (file.includes('_processed') || file.includes('_handwritten')) {
        fs.unlinkSync(path.join(directory, file));
      }
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}
