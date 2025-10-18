// Enhanced receipt parser with right-side price detection
export function parseReceipt(text) {
  console.log("📝 Parsing receipt text...");
  
  if (!text || text.length < 10) {
    return [];
  }

  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 2);

  const items = [];

  console.log('🔍 Processing lines:', lines.length);

  for (const line of lines) {
    // Skip obvious non-item lines
    if (shouldSkipLine(line)) continue;

    console.log('📝 Processing line:', line);

    // Find the rightmost price in the line
    const rightmostPrice = findRightmostPrice(line);
    if (!rightmostPrice) {
      console.log('❌ No valid price found in line');
      continue;
    }

    const { price, priceMatch, priceIndex } = rightmostPrice;
    console.log('💰 Found price:', price, 'at position:', priceIndex);

    // Extract item name (everything before the price)
    let itemName = line.substring(0, priceIndex).trim();
    
    // Clean item name and remove leading quantities
    itemName = cleanItemName(itemName);
    
    if (itemName.length < 2 || itemName.length > 50) {
      console.log('❌ Item name too short/long:', itemName);
      continue;
    }

    // Extract quantity if present at the beginning
    let quantity = 1;
    const qtyMatch = itemName.match(/^(\d{1,2})\s*[x×*]?\s*/i);
    if (qtyMatch) {
      const q = parseInt(qtyMatch[1]);
      if (q > 0 && q <= 99) {
        quantity = q;
        itemName = itemName.replace(/^\d{1,2}\s*[x×*]?\s*/i, '').trim();
      }
    }

    // Final validation
    if (itemName.length >= 2 && !isItemNameInvalid(itemName)) {
      const finalItem = {
        name: capitalizeWords(itemName),
        quantity: quantity,
        price: price
      };
      
      console.log('✅ Added item:', finalItem);
      items.push(finalItem);
    } else {
      console.log('❌ Item name invalid:', itemName);
    }
  }

  // Remove duplicates and limit
  const uniqueItems = removeDuplicates(items);
  console.log('📦 Final items:', uniqueItems.length);
  
  return uniqueItems.slice(0, 30);
}

function findRightmostPrice(line) {
  // Enhanced price patterns that prioritize right-side positioning
  const pricePatterns = [
    // Currency symbol + price at end of line (highest priority)
    /([£$€¥₹])\s*(\d{1,4}[.,]\d{2})\s*$/,
    // Price + currency symbol at end of line (highest priority)
    /(\d{1,4}[.,]\d{2})\s*([£$€¥₹])\s*$/,
    // Price at end of line (no currency) (high priority)
    /(\d{1,4}[.,]\d{2})\s*$/,
    // Currency symbol + price (anywhere, but prefer rightmost)
    /([£$€¥₹])\s*(\d{1,4}[.,]\d{2})/g,
    // Price + currency symbol (anywhere, but prefer rightmost)
    /(\d{1,4}[.,]\d{2})\s*([£$€¥₹])/g,
    // Just price with 2 decimal places (anywhere, but prefer rightmost)
    /(\d{1,4}[.,]\d{2})/g
  ];

  let bestMatch = null;
  let bestPrice = null;
  let bestIndex = -1;

  for (let i = 0; i < pricePatterns.length; i++) {
    const pattern = pricePatterns[i];
    
    if (pattern.global) {
      // For global patterns, find the rightmost match
      let match;
      let rightmostMatch = null;
      let rightmostIndex = -1;
      
      // Reset regex lastIndex to avoid issues with global regex
      pattern.lastIndex = 0;
      
      while ((match = pattern.exec(line)) !== null) {
        const matchIndex = match.index;
        if (matchIndex > rightmostIndex) {
          rightmostMatch = match;
          rightmostIndex = matchIndex;
        }
      }
      
      if (rightmostMatch) {
        const priceStr = rightmostMatch[0];
        const price = parseFloat(priceStr.replace(/[£$€¥₹\s]/g, '').replace(',', '.'));
        
        // Validate price range and position
        if (isValidPrice(price, line, rightmostIndex)) {
          if (!bestMatch || rightmostIndex > bestIndex || i < 3) { // Prioritize end-of-line patterns
            bestMatch = rightmostMatch;
            bestPrice = price;
            bestIndex = rightmostIndex;
          }
        }
      }
    } else {
      // For non-global patterns (end-of-line), these have highest priority
      const match = line.match(pattern);
      if (match) {
        const matchIndex = line.lastIndexOf(match[0]);
        const priceStr = match[0];
        const price = parseFloat(priceStr.replace(/[£$€¥₹\s]/g, '').replace(',', '.'));
        
        if (isValidPrice(price, line, matchIndex)) {
          // End-of-line patterns always win
          bestMatch = match;
          bestPrice = price;
          bestIndex = matchIndex;
          break; // Stop searching, we found an end-of-line price
        }
      }
    }
  }

  if (bestMatch && bestPrice !== null) {
    return {
      price: bestPrice,
      priceMatch: bestMatch[0],
      priceIndex: bestIndex
    };
  }

  return null;
}

function isValidPrice(price, line, priceIndex) {
  // Basic price range validation
  if (price < 0.01 || price > 9999.99) return false;
  
  // Check if price is reasonably positioned (should be in right half of line)
  const lineLength = line.length;
  const relativePosition = priceIndex / lineLength;
  
  // Prefer prices in the right 60% of the line, but don't completely exclude others
  if (relativePosition < 0.3) return false; // Too far left, likely not a price
  
  // Check if there's enough text before the price for an item name
  const textBeforePrice = line.substring(0, priceIndex).trim();
  if (textBeforePrice.length < 2) return false;
  
  // Avoid prices that are clearly quantities or item codes (small numbers on the left)
  if (relativePosition < 0.5 && price < 10) return false;
  
  // Avoid obvious non-prices (like dates, times, quantities)
  const textAfterPrice = line.substring(priceIndex + 10).trim();
  if (textAfterPrice.length > 10) return false; // Price should be near end
  
  // Additional validation: avoid prices that are part of longer number sequences
  const beforeChar = priceIndex > 0 ? line[priceIndex - 1] : ' ';
  const afterPriceText = line.substring(priceIndex + String(price).length + 3);
  
  // Skip if price is part of a longer number (like item codes)
  if (/\d/.test(beforeChar) && !/[\s£$€¥₹]/.test(beforeChar)) return false;
  if (/^\d/.test(afterPriceText) && afterPriceText.length > 2) return false;
  
  return true;
}

function shouldSkipLine(line) {
  const lower = line.toLowerCase();
  const skipWords = [
    'total', 'subtotal', 'tax', 'vat', 'change', 'cash', 'card',
    'receipt', 'thank', 'welcome', 'store', 'date', 'time', 'till',
    'balance', 'payment', 'tender', 'operator', 'cashier', 'discount',
    'sale', 'savings', 'member', 'points', 'rewards', 'promo'
  ];
  
  // Skip lines with common non-item indicators
  if (skipWords.some(word => lower.includes(word))) return true;
  
  // Skip very short lines
  if (line.length < 5) return true;
  
  // Skip lines that are just numbers
  if (/^\d+$/.test(line)) return true;
  
  // Skip lines without letters (likely separators or codes)
  if (!/[a-zA-Z]{2,}/.test(line)) return true;
  
  // Skip lines that are mostly special characters
  if (/^[*\-=_#\s\.]{3,}$/.test(line)) return true;
  
  // Skip lines that look like headers/footers
  if (/^(store|shop|market|receipt|invoice|bill)/i.test(line)) return true;
  
  // Skip lines with only time/date patterns
  if (/^\d{1,2}[\/\-:]\d{1,2}[\/\-:]\d{2,4}/.test(line)) return true;
  
  // Skip lines that are mostly uppercase (likely headers)
  const upperCaseRatio = (line.match(/[A-Z]/g) || []).length / line.length;
  if (upperCaseRatio > 0.8 && line.length > 10) return true;
  
  return false;
}

function cleanItemName(name) {
  return name
    .replace(/^\d{1,2}\s*[x×*]?\s*/i, '') // Remove leading quantity
    .replace(/\b\d{4,}\b/g, ' ')          // Remove item codes (4+ digits)
    .replace(/[^\w\s&'.-]/g, ' ')         // Remove special chars except common ones
    .replace(/\s+/g, ' ')                 // Normalize spaces
    .trim();
}

function isItemNameInvalid(name) {
  const lower = name.toLowerCase();
  
  // Skip names that are mostly numbers
  if (/^\d+/.test(name) && name.length < 6) return true;
  
  // Skip obvious non-items
  const invalidPatterns = [
    /^(qty|quantity|price|total|tax|vat|disc|discount)\s*$/i,
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,  // Dates
    /^\d{1,2}:\d{2}$/,               // Times
    /^[a-z]\d+$/i,                   // Item codes like A123
    /^\d+[a-z]$/i,                   // Item codes like 123A
    /^(ref|sku|code|id)\s*\d+/i,     // Reference codes
  ];
  
  return invalidPatterns.some(pattern => pattern.test(name));
}

function capitalizeWords(str) {
  return str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
}

function removeDuplicates(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = item.name.toLowerCase().replace(/\s+/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Legacy function for compatibility
export function parseReceiptItems(text) {
  return parseReceipt(text);
}