import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { sendPaymentAlert } from "@/lib/emailjs";
import { syncStripeSessionToSupabase, updateSupabasePaymentStatus } from "@/lib/supabase";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  let event: Stripe.Event;

  if (webhookSecret && sig) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: unknown) {
      console.error("Signature webhook Stripe invalide:", err);
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }
  } else {
    try {
      event = JSON.parse(body) as Stripe.Event;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === "paid") {
      try {
        await syncStripeSessionToSupabase(session);
      } catch (dbErr) {
        console.error("Erreur sync Supabase webhook:", dbErr);
      }

      try {
        await sendPaymentAlert(session);
      } catch (err) {
        console.error("Erreur d'envoi webhook EmailJS:", err);
      }

      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;

      try {
        await updateSupabasePaymentStatus(session.id, {
          payment_status: "paid",
          session_status: session.status || "complete",
          stripe_payment_intent_id: paymentIntentId,
          email_alert_sent: true,
          email_alert_sent_at: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.error("Erreur mise à jour Supabase webhook:", dbErr);
      }
    }
  }

  return NextResponse.json({ received: true });
}
