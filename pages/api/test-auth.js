// Test API endpoint to debug authentication issues
export default async function handler(req, res) {
  try {
    console.log('🧪 Test Auth Endpoint Called');
    console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('🎯 Method:', req.method);
    console.log('📦 Body:', req.body);
    
    // Check environment variables
    const hasToken = !!process.env.TELEGRAM_BOT_TOKEN;
    const tokenPreview = hasToken ? process.env.TELEGRAM_BOT_TOKEN.substring(0, 10) + '...' : 'MISSING';
    
    console.log('🔑 Environment Check:', {
      hasToken,
      tokenPreview,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV
    });
    
    // Test our authentication logic
    const authHeader = req.headers.authorization;
    const isInternalBot = req.headers['x-bot-internal'] === 'true';
    const expectedToken = `Bearer ${process.env.TELEGRAM_BOT_TOKEN}`;
    
    const authTest = {
      hasAuthHeader: !!authHeader,
      authHeaderValue: authHeader || 'MISSING',
      isInternalBot,
      internalBotHeader: req.headers['x-bot-internal'] || 'MISSING',
      hasExpectedToken: !!expectedToken,
      expectedTokenPreview: expectedToken.substring(0, 20) + '...',
      tokensMatch: authHeader === expectedToken,
      allHeadersMatch: isInternalBot && !!authHeader && authHeader === expectedToken
    };
    
    console.log('🔍 Auth Test Results:', authTest);
    
    return res.status(200).json({
      success: true,
      message: 'Test endpoint working',
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        hasToken,
        tokenPreview
      },
      headers: {
        authorization: req.headers.authorization ? 'present' : 'missing',
        'x-bot-internal': req.headers['x-bot-internal'] || 'missing',
        'user-agent': req.headers['user-agent'] || 'missing',
        host: req.headers.host || 'missing'
      },
      authTest
    });
    
  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Test endpoint error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}