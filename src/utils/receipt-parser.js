export function parseReceipt(text) {
  const items = [];
  const lines = text.split('\n').filter(line => line.trim().length > 3);

  // Enhanced regex to capture item name, optional quantity (with @ or x), and price
  // Supports prices with comma or dot as decimal separator
  const itemRegex = /(.+?)\s+(?:(\d+(?:\.\d+)?)\s*[x@]\s*)?(\d+[\.,]\d{2})$/;
  
  // Alternative regex for lines with quantity at the beginning
  const quantityFirstRegex = /^(\d+(?:\.\d+)?)\s*[x@]\s*(.+?)\s+(\d+[\.,]\d{2})$/;

  const exclusionKeywords = [
    'total', 'subtotal', 'tax', 'vat', 'gst', 'hst', 'pst',
    'cash', 'change', 'credit', 'card', 'visa', 'mastercard', 'amex',
    'discount', 'invoice', 'receipt', 'phone', 'date', 'time',
    'customer', 'copy', '%', 'balance', 'due', 'tip', 'gratuity', 'amount',
    'auth', 'code', 'pin', 'verified', 'tran', 'sale', 'cashier', 'store',
    'thank', 'you', 'welcome', 'please', 'visit', 'www', 'http', 'https',
    'order', 'no', 'table', 'server', 'payment'
  ];
  
  const exclusionRegex = new RegExp(`\\b(${exclusionKeywords.join('|')})\\b`, 'i');

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip lines containing exclusion keywords
    if (exclusionRegex.test(trimmedLine.toLowerCase())) {
      continue;
    }
    
    // Skip very short lines that likely aren't items
    if (trimmedLine.length < 5) {
      continue;
    }
    
    // Normalize price format (replace comma with dot for decimal)
    const cleanLine = trimmedLine.replace(/,/g, '.');
    
    // Try standard format first (item name, then quantity, then price)
    let match = cleanLine.match(itemRegex);
    
    // If no match, try quantity-first format
    if (!match) {
      match = cleanLine.match(quantityFirstRegex);
      if (match) {
        // Rearrange capture groups to match standard format
        match = [match[0], match[2], match[1], match[3]];
      }
    }
    
    if (match) {
      let name = match[1].trim();
      
      // Clean up item name from OCR artifacts and non-alphanumeric characters
      // Keep letters, numbers, spaces, and some basic punctuation
      name = name.replace(/[^\p{L}\p{N}\s\-&\.]/gu, '').trim();

      const quantity = match[2] ? parseFloat(match[2]) : 1;
      const price = parseFloat(match[3].replace(',', '.'));

      // Additional validation to ensure this is a legitimate item
      if (
        name && 
        !isNaN(price) && 
        price > 0 && 
        name.length > 1 && 
        !/^\d{4,}$/.test(name) &&  // Avoid lines that are just numbers
        price < 10000  // Reasonable price cap to filter out misreads
      ) {
        // Check if this item is likely to be a subtotal/total by examining its position
        const isLikelyTotal = lines.indexOf(line) > lines.length * 0.7 && 
                            price > 20 && 
                            (name.length < 5 || /total|sum|amount/i.test(name));
        
        if (!isLikelyTotal) {
          items.push({ 
            name, 
            quantity: Math.max(1, Math.round(quantity * 100) / 100), // Ensure reasonable quantity
            price 
          });
        }
      }
    }
  }

  return items;
}