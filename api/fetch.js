const https = require("https");
const http = require("http");
const { URL } = require("url");

function fetchHTML(targetUrl, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error("Too many redirects"));

    const parsedUrl = new URL(targetUrl);
    const protocol = parsedUrl.protocol === "https:" ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "identity",
        Connection: "close",
      },
      timeout: 15000,
    };

    const req = protocol.request(options, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, targetUrl).href;
        return fetchHTML(redirectUrl, redirectCount + 1).then(resolve).catch(reject);
      }

      let data = "";
      res.setEncoding("utf8");

      res.on("data", (chunk) => {
        data += chunk;
        if (data.length > 10 * 1024 * 1024) {
          req.destroy();
          reject(new Error("Response too large (max 10MB)"));
        }
      });

      res.on("end", () => resolve(data));
      res.on("error", reject);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    req.on("error", reject);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  let targetUrl = req.query.url;

  if (!targetUrl) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(400).send(`
      <html>
        <body style="font-family:monospace;padding:20px;background:#111;color:#0f0;">
          <h2>❌ URL দাও!</h2>
          <p>Example:</p>
          <code>/api/fetch?url=https://google.com</code>
        </body>
      </html>
    `);
  }

  // Auto add https if missing
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = "https://" + targetUrl;
  }

  try {
    new URL(targetUrl);
  } catch {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(400).send("Invalid URL: " + targetUrl);
  }

  try {
    const html = await fetchHTML(targetUrl);
    // সরাসরি HTML return করো
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(200).send(html);
  } catch (err) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(500).send("Error: " + err.message);
  }
};
  
