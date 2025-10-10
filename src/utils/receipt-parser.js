export const parseReceipt = (text) => {
  const lines = text.split('\n');
  const items = [];

  // More flexible regex to find a price. This is the anchor.
  // It looks for digits, then a dot or comma, then exactly two digits.
  const priceRegex = /(\d+[.,]\d{2})\b/g;

  const exclusionKeywords = [
    'subtotal', 'total', 'tax', 'cash', 'credit', 'debit', 'change',
    'balance', 'tip', 'gratuity', 'discount', 'savings', 'coupon',
    'customer', 'copy', 'merchant', 'duplicate', 'phone', 'date',
    'invoice', 'order', 'gst', 'hst', 'pst', 'vat', 'amount', 'auth',
    'visa', 'mastercard', 'amex', 'approved', 'account', 'card', 'number'
  ];

  lines.forEach(line => {
    const cleanedLine = line.trim().toLowerCase();

    // Basic filtering
    if (cleanedLine.length < 3) return;
    if (exclusionKeywords.some(keyword => cleanedLine.includes(keyword))) return;
    
    // Find all price-like patterns in the line
    const priceMatches = [...line.matchAll(priceRegex)];

    if (priceMatches.length > 0) {
      // Assume the last price on the line is the item price
      const lastMatch = priceMatches[priceMatches.length - 1];
      const priceString = lastMatch[0].replace(',', '.');
      const price = parseFloat(priceString);

      if (isNaN(price) || price === 0) return;

      // The part before the price is the item description
      let description = line.substring(0, lastMatch.index).trim();
      
      // Remove noise from the description
      description = description.replace(/[^\w\s-]/g, ' ').trim();

      if (description.length < 2) return;

      let quantity = 1;
      let name = description;
      
      // Try to find quantity, e.g., "2 @ 5.00" or just "2" at the start
      const qtyMatch = description.match(/^(\d+)\s(.+)/);
      if (qtyMatch && !isNaN(parseInt(qtyMatch[1], 10))) {
        // Check if the number is quantity or part of the name
        // Simple heuristic: if number is small, it's likely a quantity.
        const potentialQty = parseInt(qtyMatch[1], 10);
        if (potentialQty > 0 && potentialQty < 100) { // Assume qty is less than 100
             quantity = potentialQty;
             name = qtyMatch[2].trim();
        }
      }

      // Another check for quantity like 2x, 2 x etc.
      const qtyXMatch = name.match(/(\d+)\s?[xX]\s/);
      if (qtyXMatch && quantity === 1) {
        quantity = parseInt(qtyXMatch[1], 10);
        name = name.replace(/(\d+)\s?[xX]\s/, '').trim();
      }

      // Final cleanup of the name
      name = name.replace(/\s+/g, ' ').trim();
      
      // Another check to avoid parsing lines that are just numbers or dates
      if (/^\d[\d\s./-]*$/.test(name)) return;

      if (name.length > 1) {
        items.push({
          name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
          quantity,
          price,
        });
      }
    }
  });

  return items;
};