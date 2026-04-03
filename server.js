import express from "express";
import cors from "cors";
import Razorpay from "razorpay";
import crypto from "crypto";
import mongoose from "mongoose";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ DATABASE
mongoose.connect("YOUR_MONGO_URI");

// ✅ USER MODEL
const User = mongoose.model("User", {
  email: String,
  isPaid: Boolean,
  expiry: Date,
});

// ✅ RAZORPAY
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 💳 CREATE ORDER
app.post("/create-order", async (req, res) => {
  const order = await razorpay.orders.create({
    amount: 800000, // ₹8000
    currency: "INR",
  });

  res.json(order);
});

// 🔐 VERIFY PAYMENT
app.post("/verify-payment", async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email } = req.body;

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

    res.json({ success: true });
  } else {
    res.status(400).json({ success: false });
  }
});

// 🤖 AI ROUTE (PROTECTED)
app.post("/chat", async (req, res) => {
  const { email, message } = req.body;

  const user = await User.findOne({ email });

  if (!user || !user.isPaid || user.expiry < new Date()) {
    return res.status(403).json({ error: "Payment required" });
  }

  // SIMPLE AI RESPONSE (replace later with real AI)
  res.json({
    reply: "AI response for: " + message,
  });
});

// TEST
app.get("/", (req, res) => {
  res.send("LIVE 🚀");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0");
