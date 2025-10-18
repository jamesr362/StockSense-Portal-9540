// Simple receipt parser for basic item extraction
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

  for (const line of lines) {
    // Skip obvious non-item lines
    if (shouldSkipLine(line)) continue;

    // Look for price patterns
    const priceMatch = line.match(/(\d+\.\d{2})/);
    if (!priceMatch) continue;

    const price = parseFloat(priceMatch[1]);
    if (price < 0.10 || price > 1000) continue;

    // Extract item name
    const priceIndex = line.indexOf(priceMatch[0]);
    let itemName = line.substring(0, priceIndex).trim();
    
    // Clean item name
    itemName = cleanItemName(itemName);
    
    if (itemName.length < 2) continue;

    // Look for quantity
    let quantity = 1;
    const qtyMatch = itemName.match(/^(\d+)\s*[x×*]?\s*/i);
    if (qtyMatch) {
      const q = parseInt(qtyMatch[1]);
      if (q > 0 && q <= 20) {
        quantity = q;
        itemName = itemName.replace(/^\d+\s*[x×*]?\s*/i, '');
      }
    }

    if (itemName.length >= 2) {
      items.push({
        name: itemName,
        quantity: quantity,
        price: price
      });
    }
  }

  // Remove duplicates and return
  return removeDuplicates(items).slice(0, 20);
}

function shouldSkipLine(line) {
  const lower = line.toLowerCase();
  const skipWords = [
    'total', 'subtotal', 'tax', 'vat', 'change', 'cash', 'card',
    'receipt', 'thank', 'welcome', 'store', 'date', 'time', 'till',
    'balance', 'payment', 'tender'
  ];
  
  return skipWords.some(word => lower.includes(word)) ||
         line.length < 3 ||
         /^\d+$/.test(line) ||
         !/[a-zA-Z]/.test(line) ||
         /^[*\-=_#\s\.]{3,}$/.test(line);
}

function cleanItemName(name) {
  return name
    .replace(/[^\w\s&'.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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