module.exports = function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  res.status(200).json({
    name: "🌐 Website HTML Source Fetcher API",
    version: "1.0.0",
    status: "✅ Online",
    endpoints: {
      "GET /api/fetch?url=https://example.com": "Fetch HTML source of any URL",
      "POST /api/fetch": "Same but URL in request body { url: '...' }",
      "GET /api/health": "Health check",
    },
    auth: "Required — send header: x-api-key: YOUR_SECRET_KEY",
    limits: {
      maxResponseSize: "10MB",
      timeout: "15 seconds",
      redirects: "Up to 5 redirects followed",
    },
    example: {
      request: "GET /api/fetch?url=https://google.com",
      headers: { "x-api-key": "your-secret-key" },
    },
  });
};
