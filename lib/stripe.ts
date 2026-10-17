import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY environment variable is missing.");
}

// Server-side only Stripe instance - never exposed to the client
export const stripe = new Stripe(secretKey);

