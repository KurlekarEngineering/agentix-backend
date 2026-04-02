import express from "express";
import cors from "cors";
import Stripe from "stripe";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET);

app.post("/create-checkout-session", async (req, res) => {
  const { plan } = req.body;

  const priceMap = {
    starter: process.env.PRICE_STARTER,
    growth: process.env.PRICE_GROWTH,
    business: process.env.PRICE_BUSINESS,
  };

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: priceMap[plan], quantity: 1 }],
    success_url: process.env.FRONTEND_URL + "/app",
    cancel_url: process.env.FRONTEND_URL,
  });

  res.json({ url: session.url });
});

app.post("/chat", async (req, res) => {
  const { messages, system } = req.body;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4",
      max_tokens: 1000,
      system,
      messages,
    }),
  });

  const data = await response.json();
  res.json(data);
});

const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("Agentix backend is LIVE 🚀");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
