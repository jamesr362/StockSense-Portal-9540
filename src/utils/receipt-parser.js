/**
 * Receipt text parser
 * Uses pattern matching and heuristics to extract items from receipt text
 * 
 * @param {string} text - The OCR-recognized text from a receipt
 * @returns {Array} - Array of items with name, quantity and price
 */
export function parseReceipt(text) {
  console.log("Starting receipt parsing");
  
  // Return early if text is empty or too short
  if (!text || text.length < 10) {
    console.log("Text too short, returning empty array");
    return [];
  }

  // Check for fallback mode
  if (text.includes("FALLBACK MODE")) {
    console.log("Using fallback mode parser");
    return generatePlaceholderItems();
  }

  // Split text into lines and filter out very short lines
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 3);

  console.log(`Processing ${lines.length} lines of text`);
  
  // Try pattern matching first - optimized for common receipt formats
  const items = extractItems(lines);
  
  // Log the results
  console.log(`Extracted ${items.length} items from receipt`);
  if (items.length > 0) {
    console.log("First few items:", items.slice(0, 3));
  }
  
  // If no items found, return at least some placeholder items so user has something to edit
  if (items.length === 0) {
    return generatePlaceholderItems();
  }
  
  return items;
}

/**
 * Generate placeholder items when no real items can be extracted
 * This helps users by giving them a starting point to edit
 */
function generatePlaceholderItems() {
  return [
    { name: "Item 1", quantity: 1, price: 0 },
    { name: "Item 2", quantity: 1, price: 0 }
  ];
}

/**
 * Extract items from receipt text lines
 * @param {string[]} lines - Array of text lines from the receipt
 * @returns {Array} - Array of items with name, quantity and price
 */
function extractItems(lines) {
  // Common patterns to exclude (these are typically not product items)
  const excludePatterns = [
    /total|subtotal|tax|balance|thank|receipt|order|date|time|invoice|terminal|merchant|card|cash|change|payment|due|paid|amount/i,
    /welcome|store|location|address|phone|tel|fax|email|website|www|http|customer|loyalty|points|rewards/i,
    /^\s*\d+\/\d+\/\d+\s*$/, // Date patterns
    /^\s*\d+:\d+(?:am|pm)?\s*$/i, // Time patterns
    /^\s*#\d+\s*$/, // Just a number with # prefix
    /visa|mastercard|amex|american express|credit|debit/i,
    /^\s*x+\s*$/,  // Lines with just X's (often used as separators)
    /^\s*-+\s*$/,  // Lines with just dashes (often used as separators)
    /^\s*=+\s*$/,  // Lines with just equals (often used as separators)
    /^\s*\*+\s*$/  // Lines with just asterisks (often used as separators)
  ];
  
  // Price patterns - expanded to catch more formats
  const pricePatterns = [
    /(\d+[\.,]\d{2})/g,  // Standard price format: 12.99, 12,99
    /(\$\s*\d+[\.,]\d{2})/g,  // Price with dollar sign: $12.99
    /(\d+\s*\$)/g,  // Price with trailing dollar sign: 12$
    /(\d+\s*EUR)/gi,  // Euro prices: 12 EUR
    /(\d+\s*USD)/gi,  // USD prices: 12 USD
    /(\d+\s*GBP)/gi,  // GBP prices: 12 GBP
    /(€\s*\d+[\.,]\d{1,2})/g,  // Euro symbol: €12.99
    /(£\s*\d+[\.,]\d{1,2})/g,  // Pound symbol: £12.99
    /(¥\s*\d+)/g  // Yen symbol: ¥1200
  ];
  
  const items = [];
  let currentSection = "items"; // Assume we start in the items section
  
  // Look for common receipt sections
  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i].trim();
    if (currentLine.length < 3) continue;

    const lowercasedLine = currentLine.toLowerCase();
    
    // Try to identify the current section
    if (/items|products|description|qty|quantity|price/i.test(lowercasedLine)) {
      currentSection = "items";
      continue;
    } else if (/subtotal|sub-total|sub total/i.test(lowercasedLine)) {
      currentSection = "summary";
      continue;
    } else if (/tax|vat|gst/i.test(lowercasedLine)) {
      currentSection = "summary";
      continue;
    } else if (/total|sum|amount due/i.test(lowercasedLine)) {
      currentSection = "summary";
      continue;
    } else if (/payment|paid|tender/i.test(lowercasedLine)) {
      currentSection = "payment";
      continue;
    } else if (/thank you|come again|receipt|footer|copyright/i.test(lowercasedLine)) {
      currentSection = "footer";
      continue;
    }
    
    // Only process lines in the "items" section
    if (currentSection !== "items") continue;
    
    // Skip if line matches exclude patterns
    if (excludePatterns.some(pattern => pattern.test(lowercasedLine))) continue;
    
    // Find all potential prices in the line
    let allMatches = [];
    for (const pattern of pricePatterns) {
      const matches = [...currentLine.matchAll(pattern)];
      allMatches = [...allMatches, ...matches];
    }
    
    // Skip if no prices found
    if (allMatches.length === 0) continue;
    
    // Get the rightmost price (usually the item price)
    const lastMatch = allMatches.reduce((latest, match) => 
      match.index > latest.index ? match : latest, allMatches[0]);
    
    // Extract price value
    let priceStr = lastMatch[0];
    priceStr = priceStr.replace(/[^\d.,]/g, '');  // Remove non-numeric chars except . and ,
    priceStr = priceStr.replace(',', '.');  // Replace comma with period for parsing
    
    const price = parseFloat(priceStr);
    
    // Skip unreasonable prices
    if (isNaN(price) || price <= 0 || price > 1000) continue;
    
    // Extract item name and quantity
    const priceIndex = lastMatch.index;
    if (priceIndex <= 3) continue;  // Skip if price is at the beginning
    
    let name = currentLine.substring(0, priceIndex).trim();
    
    // Try to extract quantity
    let quantity = 1;
    const qtyPatterns = [
      /(\d+(?:\.\d+)?)\s*[xX@]\s*/, // Format: 2x, 2X, 2@
      /(\d+(?:\.\d+)?)\s*(?:pc|pcs|piece|pieces)\b/i, // Format: 2pc, 2pcs
      /(\d+(?:\.\d+)?)\s*(?:qty|quantity)[:\s]/i, // Format: qty: 2, quantity 2
      /(\d+(?:\.\d+)?)\s*(?:ea|each)\b/i, // Format: 2ea, 2 each
      /^(\d+(?:\.\d+)?)\s+/ // Format: 2 Item Name (number at start of line)
    ];
    
    for (const pattern of qtyPatterns) {
      const qtyMatch = name.match(pattern);
      if (qtyMatch) {
        quantity = parseFloat(qtyMatch[1]);
        name = name.replace(qtyMatch[0], '').trim();
        break;
      }
    }
    
    // Check for quantity in previous line if no quantity found
    if (quantity === 1 && i > 0) {
      const prevLine = lines[i-1].trim();
      if (/^\d+(?:\.\d+)?$/.test(prevLine)) {
        // Previous line is just a number, likely a quantity
        quantity = parseFloat(prevLine);
      }
    }
    
    // Clean the name - remove common non-word characters
    name = name
      .replace(/^[^a-zA-Z0-9]+/, '') // Remove non-alphanumeric prefix
      .replace(/[^\w\s\-&\.,]/g, '') // Remove most special chars except common ones
      .replace(/\s{2,}/g, ' ') // Replace multiple spaces with single space
      .trim();
    
    // Only add items with valid names
    if (name && name.length >= 2 && name.length <= 50 && !/^\d+$/.test(name)) {
      // Check for duplicates before adding
      const isDuplicate = items.some(item => 
        item.name.toLowerCase() === name.toLowerCase() && 
        Math.abs(item.price - price) < 0.01
      );
      
      if (!isDuplicate) {
        items.push({
          name,
          quantity: Math.max(0.01, Math.round(quantity * 100) / 100),
          price
        });
      }
    }
  }
  
  // Sort items by their position in the text (approximated by the index of the first line they appeared in)
  return items;
}