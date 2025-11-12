export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { subscriptionId } = JSON.parse(event.body);

    // For now, return mock usage data
    // In a real implementation, you would query your database
    // to get actual usage statistics
    const mockUsageData = {
      inventory_items: Math.floor(Math.random() * 200) + 50,
      team_members: Math.floor(Math.random() * 5) + 1,
      receipt_scans: Math.floor(Math.random() * 150) + 25,
      api_calls: Math.floor(Math.random() * 1000) + 100,
      storage_used_mb: Math.floor(Math.random() * 500) + 50,
      period_start: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60), // 30 days ago
      period_end: Math.floor(Date.now() / 1000) + (5 * 24 * 60 * 60), // 5 days from now
      last_updated: Math.floor(Date.now() / 1000)
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        usage: mockUsageData,
        subscription_id: subscriptionId
      }),
    };

  } catch (error) {
    console.error('Usage data error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Failed to get usage data',
        message: error.message
      }),
    };
  }
};