// Datei: api/index.js (Vercel-kompatibel als Serverless Function)

const Parser = require("rss-parser");
const parser = new Parser();

const PRICE_PER_MINUTE_DKK = 0.5;
let users = [{ id: 1, email: "test@example.com", balance: 60 }];
let readingSessions = {}; // { userId: { articleId, startTime } }

module.exports = async (req, res) => {
  const { method, url } = req;
  let body = {};

  if (req.headers["content-type"] === "application/json" && req.method !== "GET") {
    body = await new Promise(resolve => {
      let data = "";
      req.on("data", chunk => (data += chunk));
      req.on("end", () => resolve(JSON.parse(data)));
    });
  }

  if (url === "/api/login" && method === "POST") {
    const { email } = body;
    let user = users.find(u => u.email === email);
    if (!user) {
      user = { id: users.length + 1, email, balance: 60 };
      users.push(user);
    }
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ userId: user.id, token: "demo-token" }));
  }

  if (url === "/api/articles" && method === "GET") {
    try {
      const berlingske = await parser.parseURL("https://www.berlingske.dk/rss");
      const politiken = await parser.parseURL("https://politiken.dk/rss");
      const articles = [...berlingske.items, ...politiken.items].slice(0, 10).map((item, index) => ({
        id: index + 1,
        title: item.title,
        body: item.contentSnippet || item.content || "(Indhold ikke tilgængeligt)",
      }));
      res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify(articles));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Kunne ikke hente nyheder" }));
    }
  }

  if (url === "/api/start-read" && method === "POST") {
    const { userId, articleId } = body;
    readingSessions[userId] = { articleId, startTime: Date.now() };
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: true }));
  }

  if (url === "/api/stop-read" && method === "POST") {
    const { userId } = body;
    const session = readingSessions[userId];
    if (!session) res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Ingen aktiv session" }));

    const minutes = Math.ceil((Date.now() - session.startTime) / 60000);
    const user = users.find(u => u.id === userId);
    if (!user || user.balance < minutes)
      res.writeHead(402, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Ikke nok minutter tilbage" }));

    const price = (minutes * PRICE_PER_MINUTE_DKK).toFixed(2);
    user.balance -= minutes;
    delete readingSessions[userId];
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ minutesUsed: minutes, newBalance: user.balance, price: parseFloat(price) }));
  }

  if (url.startsWith("/api/balance") && method === "GET") {
    const urlObj = new URL("http://localhost" + url);
    const userId = parseInt(urlObj.searchParams.get("userId"));
    const user = users.find(u => u.id === userId);
    if (!user) res.writeHead(404, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Bruger ikke fundet" }));
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ balance: user.balance, pricePerMinute: PRICE_PER_MINUTE_DKK }));
  }

  if (url === "/api/buy" && method === "POST") {
    const { userId, amount } = body;
    const user = users.find(u => u.id === userId);
    if (!user) res.writeHead(404, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Bruger ikke fundet" }));
    user.balance += amount;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ success: true, newBalance: user.balance, added: amount }));
  }

  res.writeHead(404).end(JSON.stringify({ error: "Ikke fundet" }));
};
