const https = require("https");
const http = require("http");
const { URL } = require("url");

// ✅ API Key Validation
function validateApiKey(req) {
  const apiKey =
    req.headers["x-api-key"] ||
    req.headers["authorization"]?.replace("Bearer ", "");
  return apiKey === process.env.API_KEY;
}

// ✅ URL থেকে HTML fetch করার function
function fetchHTML(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const protocol = parsedUrl.protocol === "https:" ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "identity",
        Connection: "close",
      },
      timeout: 15000,
    };

    const req = protocol.request(options, (res) => {
      // ✅ Redirect handle করো (max 5 redirects)
      if (
        [301, 302, 303, 307, 308].includes(res.statusCode) &&
        res.headers.location
      ) {
        const redirectUrl = new URL(res.headers.location, targetUrl).href;
        return fetchHTML(redirectUrl).then(resolve).catch(reject);
      }

      let data = "";
      res.setEncoding("utf8");

      res.on("data", (chunk) => {
        data += chunk;
        // ✅ 10MB limit
        if (data.length > 10 * 1024 * 1024) {
          req.destroy();
          reject(new Error("Response too large (max 10MB)"));
        }
      });

      res.on("end", () => {
        resolve({
          html: data,
          statusCode: res.statusCode,
          contentType: res.headers["content-type"] || "text/html",
          size: Buffer.byteLength(data, "utf8"),
        });
      });

      res.on("error", reject);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout (15s exceeded)"));
    });

    req.on("error", reject);
    req.end();
  });
}

// ✅ CORS Headers set করো
function setCORSHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "x-api-key, Authorization, Content-Type"
  );
}

// ✅ Main Handler
module.exports = async function handler(req, res) {
  setCORSHeaders(res);

  // Preflight OPTIONS request handle
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // শুধু GET এবং POST allow
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use GET or POST.",
    });
  }

  // ✅ API Key Check
  if (!validateApiKey(req)) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized. Invalid or missing API key.",
      hint: "Provide your key via header: x-api-key: YOUR_KEY",
    });
  }

  // ✅ URL নাও query বা body থেকে
  let targetUrl = req.query.url;

  if (!targetUrl && req.method === "POST") {
    try {
      const body =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      targetUrl = body?.url;
    } catch {
      return res.status(400).json({
        success: false,
        error: "Invalid JSON body.",
      });
    }
  }

  if (!targetUrl) {
    return res.status(400).json({
      success: false,
      error: "Missing 'url' parameter.",
      usage: {
        GET: "/api/fetch?url=https://example.com",
        POST: { body: { url: "https://example.com" } },
      },
    });
  }

  // ✅ URL validate করো
  try {
    const parsed = new URL(targetUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Only http/https URLs are allowed.");
    }
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: `Invalid URL: ${err.message}`,
    });
  }

  // ✅ HTML Fetch করো
  try {
    const startTime = Date.now();
    const result = await fetchHTML(targetUrl);
    const elapsed = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      url: targetUrl,
      statusCode: result.statusCode,
      contentType: result.contentType,
      size: result.size,
      sizeFormatted: formatBytes(result.size),
      lines: result.html.split("\n").length,
      fetchedInMs: elapsed,
      html: result.html,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch the URL.",
      url: targetUrl,
    });
  }
};

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}
