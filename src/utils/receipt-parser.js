export const parseReceipt = (text) => {
  const items = [];
  const lines = text.split('\n');

  // Regex patterns to capture various formats of item lines.
  // Format 1: Item Name, optional quantity (e.g., 2 @), Price, Total Price (e.g., "ITEM NAME 2 @ 1.00 2.00")
  const itemRegexWithAt = new RegExp(
    /^(.*?)\s+(?:(\d+)\s*@\s*)?\$?(\d+\.\d{2})\s+\$?(\d+\.\d{2})$/,
    'i'
  );
  // Format 2: Quantity, Item Name, Price (e.g., "1 ITEM NAME 5.99")
  const qtyFirstRegex = new RegExp(
    /^(\d+)\s+(.*?)\s+\$?(\d+\.\d{2})$/
  );
  // Format 3: Item Name, optional quantity, Price (e.g., "ITEM NAME 2 9.99" or "ITEM NAME 9.99")
  const generalItemRegex = new RegExp(
    /^(.*?)\s+(?:(\d+)\s*[xX]?\s*)?\$?(\d+\.\d{2})$/
  );

  // Keywords to identify lines that are likely not items
  const exclusionKeywords = [
    'total', 'subtotal', 'tax', 'vat', 'cash', 'card', 'change', 'discount', 'savings',
    'phone', 'tel', 'date', 'time', 'receipt', 'invoice', 'gst', 'hst', 'pst',
    'www', '.com', 'order', 'clerk', 'server', 'customer', 'loyalty', 'points',
    'balance', 'approved', 'authorization', 'reference'
  ];
  const exclusionRegex = new RegExp(exclusionKeywords.join('|'), 'i');

  for (const line of lines) {
    const trimmedLine = line.trim().replace(/\s+/g, ' ');

    if (trimmedLine.length < 3 || exclusionRegex.test(trimmedLine) || !/\d/.test(trimmedLine)) {
      continue;
    }

    let match;
    let name, quantity, price;

    // Try matching different formats in order of specificity
    match = trimmedLine.match(itemRegexWithAt);
    if (match) {
        name = match[1].trim();
        quantity = match[2] ? parseInt(match[2], 10) : 1;
        price = parseFloat(match[4]); // Total price for the line
    } else {
        match = trimmedLine.match(qtyFirstRegex);
        if (match) {
            quantity = parseInt(match[1], 10);
            name = match[2].trim();
            price = parseFloat(match[3]);
        } else {
            match = trimmedLine.match(generalItemRegex);
            if (match) {
                name = match[1].trim();
                quantity = match[2] ? parseInt(match[2], 10) : 1;
                price = parseFloat(match[3]);
            }
        }
    }
    
    // Final validation before adding the item
    if (name && !/qty|item|description|price|amount/i.test(name) && name.length > 1) {
      items.push({ 
        name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(), 
        quantity: quantity || 1, 
        price: price || 0 
      });
    }
  }

  return items;
};