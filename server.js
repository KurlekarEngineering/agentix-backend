import express from "express";
import cors from "cors";
import Razorpay from "razorpay";
import crypto from "crypto";
import mongoose from "mongoose";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
app.use(cors());
app.use(express.json());

// ================= DATABASE =================
mongoose.connect(process.env.MONGO_URI);

const UserSchema = new mongoose.Schema({
  email: String,
  isPaid: { type: Boolean, default: false },
  expiry: Date,
});

const User = mongoose.model("User", UserSchema);

// ================= RAZORPAY =================
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ================= AI (CLAUDE) =================
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_KEY,
});

// ================= ROUTES =================

// 🔹 Health check
app.get("/", (req, res) => {
  res.send("Agentix backend is LIVE 🚀");
});

// 💳 Create Order
app.post("/create-order", async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: 800000, // ₹8000
      currency: "INR",
    });

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).send("Order creation failed");
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
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
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
    console.error(err);
    res.status(500).send("Verification failed");
  }
});

// 🤖 AI CHAT (PROTECTED + REAL AI)
app.post("/chat", async (req, res) => {
  try {
    const { email, message } = req.body;

    const user = await User.findOne({ email });

    if (!user || !user.isPaid || user.expiry < new Date()) {
      return res.status(403).json({
        error: "Payment required",
      });
    }

    const aiResponse = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 300,
      system:
        "You are an AI assistant helping Indian businesses with sales, quotations, and customer replies.",
      messages: [
        {
          role: "user",
          content: message,
        },
      ],
    });

    const reply = aiResponse.content[0].text;

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).send("AI error");
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
