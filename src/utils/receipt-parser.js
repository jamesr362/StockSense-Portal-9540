export const parseReceipt = (text) => {
  const items = [];
  const lines = text.split('\n');

  // More robust regex to capture item name, quantity, and price.
  // This looks for a quantity (e.g., 1, 2x, x1), an item name, and then a price.
  // It's designed to be flexible.
  const itemRegex = new RegExp(
    /^(.*?)\s+(?:(\d+)\s*[xX@]?\s*)?\$?(\d+\.\d{2})$/,
    'i'
  );
  const itemRegexWithAt = new RegExp(
    /^(.*?)\s+(\d+)\s*@\s*(\d+\.\d{2})\s+(\d+\.\d{2})$/,
    'i'
  );
  
  // Keywords to identify lines that are likely not items
  const exclusionKeywords = [
    'total', 'subtotal', 'tax', 'vat', 'cash', 'card', 'change', 'discount', 'savings',
    'phone', 'tel', 'date', 'time', 'receipt', 'invoice', 'gst', 'hst',
    'www', '.com', '.co.uk', 'order', 'clerk', 'server', 'customer', 'loyalty'
  ];
  const exclusionRegex = new RegExp(exclusionKeywords.join('|'), 'i');

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.length < 3 || exclusionRegex.test(trimmedLine)) {
      continue;
    }

    let match = trimmedLine.match(itemRegexWithAt);
    if (match) {
        const [, name, quantity, , totalPrice] = match;
        const itemName = name.trim().replace(/\s+/g, ' ');
        if(itemName) {
            items.push({
                name: itemName,
                quantity: parseInt(quantity, 10),
                price: parseFloat(totalPrice),
            });
        }
        continue;
    }

    match = trimmedLine.match(itemRegex);
    if (match) {
      let [, name, quantity, price] = match;
      
      name = name.trim().replace(/\s+/g, ' ');
      quantity = quantity ? parseInt(quantity, 10) : 1;
      price = parseFloat(price);

      // Filter out lines that are likely headers or other non-item text
      if (name && !/qty|item|description|price/i.test(name)) {
        items.push({ name, quantity, price });
      }
    }
  }

  return items;
};