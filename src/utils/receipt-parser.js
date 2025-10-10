export const parseReceipt = (text) => {
  const lines = text.split('\n');
  const items = [];

  // More robust regex to capture various item/price formats.
  // Handles optional quantity, item names (can include spaces), and various price formats.
  const itemRegex = new RegExp(
    /^(?:(\d+)\s+)?(.+?)\s+(\$?(\d+\.\d{2}))$/,
    'i'
  );

  // Expanded list of keywords to exclude non-item lines.
  const exclusionKeywords = [
    'subtotal', 'total', 'tax', 'cash', 'credit', 'debit', 'change',
    'balance', 'tip', 'gratuity', 'discount', 'savings', 'coupon',
    'customer', 'copy', 'merchant', 'duplicate', 'phone', 'date',
    'invoice', 'order', 'gst', 'hst', 'pst', 'vat', 'amount', 'auth'
  ];

  lines.forEach(line => {
    const cleanedLine = line.trim().toLowerCase();

    // Skip empty lines or lines that are too short to be an item
    if (cleanedLine.length < 3) {
      return;
    }

    // Check if the line contains any exclusion keywords
    const containsKeyword = exclusionKeywords.some(keyword => cleanedLine.includes(keyword));
    if (containsKeyword) {
      return;
    }

    const match = line.trim().match(itemRegex);

    if (match) {
      let quantity = parseInt(match[1], 10);
      if (isNaN(quantity)) {
        quantity = 1; // Default quantity to 1 if not found
      }

      const name = match[2].trim();
      const price = parseFloat(match[4]);

      // Final sanity check for valid data
      if (name && !isNaN(price) && name.length > 1) {
        items.push({
          name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize first letter
          quantity,
          price,
        });
      }
    }
  });

  return items;
};