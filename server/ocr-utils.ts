import sharp from 'sharp';
import * as Tesseract from 'tesseract.js';
import fs from 'fs';
import path from 'path';

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

// Apply OCR character corrections based on context
export function applyCharacterCorrections(text: string): string {
  let correctedText = text;
  
  // Fix common misreads in numeric contexts (amounts, dates)
  // Pattern: Look for sequences that should be numbers
  
  // Fix amounts like "$1oo.oo" -> "$100.00" or "S100" -> "$100"
  correctedText = correctedText.replace(/\$?[S5]?(\d*[oOlI|\d]+(?:[.,]\d{2})?)/g, (match) => {
    let fixed = match;
    // Replace letter-like chars in numeric context
    fixed = fixed.replace(/[oO]/g, '0');
    fixed = fixed.replace(/[lI|]/g, '1');
    fixed = fixed.replace(/^S(\d)/, '$$$1'); // S at start of number -> $
    return fixed;
  });
  
  // Fix dates - look for date-like patterns and correct them
  correctedText = correctedText.replace(/(\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?/g, (match, p1, p2, p3) => {
    let day = p1.replace(/[oO]/g, '0').replace(/[lI|]/g, '1').replace(/[sS]/g, '5');
    let month = p2.replace(/[oO]/g, '0').replace(/[lI|]/g, '1').replace(/[sS]/g, '5');
    let year = p3 ? p3.replace(/[oO]/g, '0').replace(/[lI|]/g, '1').replace(/[sS]/g, '5') : '';
    
    const sep = match.includes('.') ? '.' : match.includes('-') ? '-' : '/';
    return year ? `${day}${sep}${month}${sep}${year}` : `${day}${sep}${month}`;
  });
  
  // Fix standalone numbers that might have letter substitutions
  correctedText = correctedText.replace(/\b(\d*[oOlIsS|\d]+)\b/g, (match) => {
    // Only fix if there are actual number-like patterns
    if (!/\d/.test(match)) return match;
    
    let fixed = match;
    fixed = fixed.replace(/[oO]/g, '0');
    fixed = fixed.replace(/[lI|]/g, '1');
    fixed = fixed.replace(/[sS]/g, '5');
    return fixed;
  });
  
  return correctedText;
}

// Parse dates from text with multiple format support
export function extractDates(text: string): { dateStr: string; isoDate: string; confidence: number }[] {
  const correctedText = applyCharacterCorrections(text);
  const dates: { dateStr: string; isoDate: string; confidence: number }[] = [];
  const seen = new Set<string>();
  
  for (const { pattern, parse } of DATE_PATTERNS) {
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

// Extract amounts from text
export function extractAmounts(text: string): { amount: number; original: string; confidence: number }[] {
  const correctedText = applyCharacterCorrections(text);
  const amounts: { amount: number; original: string; confidence: number }[] = [];
  
  // Pattern for money amounts
  const amountPatterns = [
    // $1,234.56 or $1234.56 or 1,234.56 or 1234.56
    /\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g,
    // Total: $123 or Amount: 123.45
    /(?:total|amount|sum|due|pay)[:\s]*\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/gi,
  ];
  
  const seen = new Set<number>();
  
  for (const pattern of amountPatterns) {
    pattern.lastIndex = 0;
    let match;
    
    while ((match = pattern.exec(correctedText)) !== null) {
      const numStr = (match[1] || match[0]).replace(/[$,\s]/g, '');
      const amount = parseFloat(numStr);
      
      if (isNaN(amount) || amount <= 0) continue;
      if (seen.has(amount)) continue;
      seen.add(amount);
      
      // Calculate confidence
      let confidence = 60;
      if (match[0].includes('$')) confidence += 20;
      if (/total|amount|sum|due|pay/i.test(match[0])) confidence += 15;
      if (match[0].includes('.')) confidence += 5;
      
      amounts.push({
        amount,
        original: match[0].trim(),
        confidence: Math.min(confidence, 100)
      });
    }
  }
  
  // Sort by amount (larger amounts first, typically totals)
  return amounts.sort((a, b) => b.amount - a.amount);
}

// Extract staff/property names
export function extractNames(text: string): { name: string; type: 'staff' | 'property' | 'unknown'; confidence: number }[] {
  const correctedText = applyCharacterCorrections(text);
  const names: { name: string; type: 'staff' | 'property' | 'unknown'; confidence: number }[] = [];
  
  // Staff name patterns
  const staffPatterns = [
    /(?:from|by|contractor|staff|name|employee)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g, // Capitalized multi-word names
  ];
  
  // Property/address patterns
  const propertyPatterns = [
    /(?:property|address|location|unit|apt|apartment)[:\s#]*([A-Z0-9][^\n,]{3,50})/gi,
    /(\d+\s+[A-Z][a-z]+(?:\s+(?:St|Ave|Rd|Dr|Ln|Blvd|Way|Ct)\.?))/gi,
  ];
  
  const seen = new Set<string>();
  
  // Extract staff names
  for (const pattern of staffPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(correctedText)) !== null) {
      const name = (match[1] || match[0]).trim();
      const normalized = name.toLowerCase();
      
      if (name.length < 3 || name.length > 50) continue;
      if (seen.has(normalized)) continue;
      if (/^(the|a|an|and|or|for|to|from|with)$/i.test(name)) continue;
      
      seen.add(normalized);
      
      let confidence = 50;
      if (/from|by|contractor|staff|name/i.test(match[0])) confidence += 30;
      if (/^[A-Z][a-z]+\s+[A-Z][a-z]+$/.test(name)) confidence += 15;
      
      names.push({ name, type: 'staff', confidence: Math.min(confidence, 100) });
    }
  }
  
  // Extract property names
  for (const pattern of propertyPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(correctedText)) !== null) {
      const name = (match[1] || match[0]).trim();
      const normalized = name.toLowerCase();
      
      if (name.length < 3 || name.length > 100) continue;
      if (seen.has(normalized)) continue;
      
      seen.add(normalized);
      
      let confidence = 50;
      if (/property|address|location/i.test(match[0])) confidence += 25;
      if (/\d+/.test(name)) confidence += 10;
      
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
  // Perform OCR with preprocessing
  const ocrResult = await performOCR(imagePath, isHandwritten);
  
  // Apply character corrections
  const correctedText = applyCharacterCorrections(ocrResult.text);
  
  // Extract structured data
  const dates = extractDates(correctedText);
  const amounts = extractAmounts(correctedText);
  const names = extractNames(correctedText);
  
  return {
    rawText: ocrResult.text,
    correctedText,
    dates,
    amounts,
    names,
    ocrConfidence: ocrResult.confidence
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
