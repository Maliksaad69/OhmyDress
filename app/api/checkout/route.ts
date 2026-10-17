import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const rawAmount = body.amount;
    const amount = typeof rawAmount === "number" ? rawAmount : parseFloat(String(rawAmount).replace(",", "."));

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Veuillez indiquer un montant valide supérieur à 0 €." },
        { status: 400 }
      );
    }

    if (amount < 0.5) {
      return NextResponse.json(
        { error: "Le montant minimum pour le paiement est de 0,50 €." },
        { status: 400 }
      );
    }

    const rawShipping = body.shippingCost;
    const shippingCost =
      rawShipping !== undefined && rawShipping !== null
        ? typeof rawShipping === "number"
          ? rawShipping
          : parseFloat(String(rawShipping).replace(",", "."))
        : 5.0;

    const orderReference = (body.orderReference || "").trim();
    const articleName = (body.articleName || "").trim();
    const tiktokUsername = (body.tiktokUsername || "").trim();
    const email = (body.email || "").trim();
    const customer = body.customer || {};

    // Determine the base URL for redirects safely
    let cleanOrigin = "";
    if (request.headers.get("origin")) {
      cleanOrigin = request.headers.get("origin")!;
    } else {
      const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
      const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
      if (forwardedHost) {
        cleanOrigin = `${forwardedProto}://${forwardedHost}`;
      } else if (process.env.NEXT_PUBLIC_SITE_URL) {
        cleanOrigin = process.env.NEXT_PUBLIC_SITE_URL;
      } else {
        cleanOrigin = new URL(request.url).origin;
      }
    }
    cleanOrigin = cleanOrigin.split("?")[0].replace(/\/$/, "");

    const productName =
      articleName ||
      (tiktokUsername
        ? `Commande TikTok (@${tiktokUsername.replace(/^@/, "")})`
        : "Commande Showroom en direct");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email && email.includes("@") ? email : undefined,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: productName,
              description: orderReference
                ? `Réf commande : ${orderReference}`
                : "Achat convenu lors du live Oh My Dress",
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
        ...(shippingCost > 0
          ? [
              {
                price_data: {
                  currency: "eur",
                  product_data: {
                    name: "Livraison Mondial Relay (Point Relais)",
                    description: "3 à 5 jours ouvrés avec suivi",
                  },
                  unit_amount: Math.round(shippingCost * 100),
                },
                quantity: 1,
              },
            ]
          : []),
      ],
      metadata: {
        order_reference: orderReference,
        tiktok_username: tiktokUsername,
        article_name: articleName,
        custom_amount: amount.toFixed(2),
        shipping_cost: shippingCost.toFixed(2),
        customer_name: `${customer.firstName || ""} ${customer.lastName || ""}`.trim(),
        customer_phone: customer.phone || "",
        shipping_address: `${customer.address1 || ""} ${customer.address2 || ""}, ${customer.zip || ""} ${customer.city || ""}, ${customer.country || "FR"}`.trim(),
      },
      success_url: `${cleanOrigin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${cleanOrigin}/?canceled=true`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Impossible de générer le lien de paiement Stripe sécurisé." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    // Log complete error securely on server only
    console.error("Erreur lors de la création de la session Stripe:", error);

    // Never expose raw internal Stripe errors or potential key traces to frontend
    return NextResponse.json(
      { error: "Une erreur est survenue lors de l'initialisation du paiement sécurisé. Veuillez réessayer ou contacter le showroom." },
      { status: 500 }
    );
  }
}
