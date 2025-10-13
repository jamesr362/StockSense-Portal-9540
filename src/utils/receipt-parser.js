export function parseReceipt(text) {
  const items = [];
  const lines = text.split('\n').filter(line => line.trim().length > 3);

  // Regex to capture item name, optional quantity, and price (allows comma or dot).
  const itemRegex = /(.+?)\s+(?:(\d+)\s*[x@]\s*)?(\d+[\.,]\d{2})$/;

  const exclusionKeywords = [
    'total', 'subtotal', 'tax', 'vat', 'gst', 'hst', 'pst',
    'cash', 'change', 'credit', 'card', 'visa', 'mastercard', 'amex',
    'discount', 'invoice', 'receipt', 'phone', 'date', 'time',
    'customer', 'copy', '%', 'balance', 'due', 'tip', 'gratuity', 'amount',
    'auth', 'code', 'pin', 'verified', 'tran', 'sale'
  ];
  
  const exclusionRegex = new RegExp(`\\b(${exclusionKeywords.join('|')})\\b`, 'i');

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (exclusionRegex.test(trimmedLine)) {
      continue;
    }
    
    // Normalize price format
    const cleanLine = trimmedLine.replace(/,/g, '.');
    const match = cleanLine.match(itemRegex);
    
    if (match) {
      let name = match[1].trim();
      
      // Clean up item name from OCR artifacts and non-alphanumeric characters (keeps letters, numbers, spaces).
      // The \p{L} class and u flag allow for Unicode letters from various languages.
      name = name.replace(/[^\p{L}\p{N}\s]/gu, '').trim();

      const quantity = match[2] ? parseInt(match[2], 10) : 1;
      const price = parseFloat(match[3].replace(',', '.'));

      // Final validation to ensure the parsed line is a legitimate item.
      // - Must have a name
      // - Price must be a valid number > 0
      // - Name should be longer than a single character
      // - Name should not look like a long number (e.g., phone number, ID)
      if (name && !isNaN(price) && price > 0 && name.length > 1 && !/^\d{4,}$/.test(name)) {
        items.push({ name, quantity, price });
      }
    }
  }

  return items;
}