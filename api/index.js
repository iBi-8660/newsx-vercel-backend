
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const Parser = require("rss-parser");
const app = express();
const parser = new Parser();

const PRICE_PER_MINUTE_DKK = 0.5;

let users = [{ id: 1, email: "test@example.com", password: "1234", balance: 60 }];
let readingSessions = {};

app.use(cors());
app.use(bodyParser.json());

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  let user = users.find(u => u.email === email && u.password === password);
  if (user) {
    res.json({ token: "demo-token", userId: user.id });
  } else {
    const newId = users.length + 1;
    user = { id: newId, email, password, balance: 60 };
    users.push(user);
    res.json({ token: "demo-token", userId: user.id, message: "Ny bruger oprettet med 60 gratis minutter." });
  }
});

app.get("/api/articles", async (req, res) => {
  try {
    const berlingske = await parser.parseURL("https://www.berlingske.dk/rss");
    const politiken = await parser.parseURL("https://politiken.dk/rss");

    const articles = [...berlingske.items, ...politiken.items].slice(0, 10).map((item, index) => ({
      id: index + 1,
      title: item.title,
      body: item.contentSnippet || item.content || "(Indhold ikke tilgængeligt)",
    }));

    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: "Kunne ikke hente nyheder" });
  }
});

app.post("/api/start-read", (req, res) => {
  const { userId, articleId } = req.body;
  readingSessions[userId] = { articleId, startTime: Date.now() };
  res.json({ ok: true });
});

app.post("/api/stop-read", (req, res) => {
  const { userId } = req.body;
  const session = readingSessions[userId];
  if (!session) return res.status(400).json({ error: "Ingen aktiv session" });

  const minutes = Math.ceil((Date.now() - session.startTime) / 60000);
  const user = users.find(u => u.id === userId);
  if (!user || user.balance < minutes) return res.status(402).json({ error: "Ikke nok minutter tilbage" });

  const price = (minutes * PRICE_PER_MINUTE_DKK).toFixed(2);
  user.balance -= minutes;
  delete readingSessions[userId];
  res.json({ minutesUsed: minutes, newBalance: user.balance, price: parseFloat(price) });
});

app.get("/api/balance", (req, res) => {
  const userId = parseInt(req.query.userId);
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: "Bruger ikke fundet" });
  res.json({ balance: user.balance, pricePerMinute: PRICE_PER_MINUTE_DKK });
});

app.post("/api/buy", (req, res) => {
  const { userId, amount } = req.body;
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: "Bruger ikke fundet" });

  user.balance += amount;
  res.json({ success: true, newBalance: user.balance, added: amount });
});

module.exports = app;
