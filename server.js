import express from "express";
import cors from "cors";
import Razorpay from "razorpay";
import crypto from "crypto";
import mongoose from "mongoose";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
app.use(cors());
app.use(express.json());

// ================= SAFE DATABASE =================
mongoose.connect(process.env.MONGO_URI || "")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ MongoDB Error:", err.message));

// ================= USER MODEL =================
const UserSchema = new mongoose.Schema({
  email: String,
  isPaid: { type: Boolean, default: false },
  expiry: Date,
});

const User = mongoose.model("User", UserSchema);

// ================= RAZORPAY =================
const razorpay = process.env.RAZORPAY_KEY_ID
  ? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
  : null;

// ================= AI =================
const anthropic = process.env.ANTHROPIC_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_KEY })
  : null;

// ================= ROUTES =================

// 🔹 Health
app.get("/", (req, res) => {
  res.send("🚀 Agentix backend LIVE");
});

// 💳 Create Order
app.post("/create-order", async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(500).json({ error: "Razorpay not configured" });
    }

    const order = await razorpay.orders.create({
      amount: 800000,
      currency: "INR",
    });

    res.json(order);
  } catch (err) {
    console.error("Order Error:", err.message);
    res.status(500).json({ error: "Order failed" });
  }
});

// 🔐 Verify Payment
app.post("/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      email,
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(body)
      .digest("hex");

    if (expected === razorpay_signature) {
      await User.findOneAndUpdate(
        { email },
        {
          isPaid: true,
          expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        { upsert: true }
      );

      return res.json({ success: true });
    } else {
      return res.status(400).json({ success: false });
    }
  } catch (err) {
    console.error("Verify Error:", err.message);
    res.status(500).json({ error: "Verification failed" });
  }
});

// 🤖 AI CHAT
app.post("/chat", async (req, res) => {
  try {
    const { email, message } = req.body;

    const user = await User.findOne({ email });

    if (!user || !user.isPaid || user.expiry < new Date()) {
      return res.status(403).json({
        error: "Payment required",
      });
    }

    // fallback if AI not configured
    if (!anthropic) {
      return res.json({
        reply: "AI not configured yet",
      });
    }

    const aiRes = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 300,
      system:
        "You help Indian businesses with sales, quotations, and customer replies.",
      messages: [
        {
          role: "user",
          content: message,
        },
      ],
    });

    const reply = aiRes.content[0].text;

    res.json({ reply });
  } catch (err) {
    console.error("AI Error:", err.message);
    res.status(500).json({ error: "AI failed" });
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Server running on port", PORT);
});
