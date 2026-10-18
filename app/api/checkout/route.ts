import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { savePaymentToSupabase } from "@/lib/supabase";

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

    const orderReference = typeof body.orderReference === "string" ? body.orderReference.trim() : "";
    if (!orderReference) {
      return NextResponse.json(
        { error: "Veuillez indiquer la référence de votre commande." },
        { status: 400 }
      );
    }

    const tiktokUsername = typeof body.tiktokUsername === "string" ? body.tiktokUsername.trim() : "";
    if (!tiktokUsername || tiktokUsername.replace(/^@/, "").trim().length < 2) {
      return NextResponse.json(
        { error: "Veuillez renseigner un pseudo TikTok valide." },
        { status: 400 }
      );
    }

    const email = typeof body.email === "string" ? body.email.trim() : "";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Veuillez renseigner une adresse e-mail valide pour la confirmation." },
        { status: 400 }
      );
    }

    const articleName = typeof body.articleName === "string" ? body.articleName.trim() : "";
    const customer = body.customer || {};
    const firstName = typeof customer.firstName === "string" ? customer.firstName.trim() : "";
    const lastName = typeof customer.lastName === "string" ? customer.lastName.trim() : "";
    const address1 = typeof customer.address1 === "string" ? customer.address1.trim() : "";
    const address2 = typeof customer.address2 === "string" ? customer.address2.trim() : "";
    const zip = typeof customer.zip === "string" ? customer.zip.trim() : "";
    const city = typeof customer.city === "string" ? customer.city.trim() : "";
    const phone = typeof customer.phone === "string" ? customer.phone.trim() : "";
    const country = typeof customer.country === "string" ? customer.country.trim() : "FR";

    if (!firstName || firstName.length < 2) {
      return NextResponse.json(
        { error: "Veuillez renseigner le prénom du destinataire." },
        { status: 400 }
      );
    }

    if (!lastName || lastName.length < 2) {
      return NextResponse.json(
        { error: "Veuillez renseigner le nom du destinataire." },
        { status: 400 }
      );
    }

    if (!address1 || address1.length < 4) {
      return NextResponse.json(
        { error: "Veuillez renseigner une adresse de livraison complète (numéro et voie)." },
        { status: 400 }
      );
    }

    if (!zip || zip.length < 2) {
      return NextResponse.json(
        { error: "Veuillez renseigner un code postal valide." },
        { status: 400 }
      );
    }

    if (!city || city.length < 2) {
      return NextResponse.json(
        { error: "Veuillez renseigner la ville de livraison." },
        { status: 400 }
      );
    }

    const digitsOnly = phone.replace(/\D/g, "");
    if (!phone || digitsOnly.length < 8) {
      return NextResponse.json(
        { error: "Veuillez renseigner un numéro de téléphone valide pour le suivi SMS du colis." },
        { status: 400 }
      );
    }

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
      customer_email: email,
      payment_intent_data: {
        receipt_email: email,
        description: orderReference
          ? `Commande ${orderReference} - Oh My Dress Live`
          : "Commande Oh My Dress Showroom",
        metadata: {
          order_reference: orderReference,
          tiktok_username: tiktokUsername,
          customer_name: `${firstName} ${lastName}`.trim(),
        },
      },
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
        customer_name: `${firstName} ${lastName}`.trim(),
        customer_email: email,
        customer_phone: phone,
        shipping_address: `${address1} ${address2}, ${zip} ${city}, ${country}`.replace(/\s+/g, " ").trim(),
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

    // Persist to Supabase with await so serverless doesn't drop the write
    try {
      await savePaymentToSupabase({
        stripe_session_id: session.id,
        order_reference: orderReference,
        tiktok_username: tiktokUsername,
        article_name: articleName,
        amount,
        shipping_cost: shippingCost,
        total_amount: amount + shippingCost,
        currency: "EUR",
        payment_status: "unpaid",
        session_status: "open",
        customer_name: `${firstName} ${lastName}`.trim(),
        customer_email: email,
        customer_phone: phone,
        shipping_address: `${address1} ${address2}, ${zip} ${city}, ${country}`.replace(/\s+/g, " ").trim(),
        shipping_address1: address1,
        shipping_address2: address2,
        shipping_city: city,
        shipping_postal_code: zip,
        shipping_country: country,
        metadata: (session.metadata || {}) as Record<string, unknown>,
      });
    } catch (dbErr) {
      console.warn("Notice: impossible d'enregistrer la session préliminaire dans Supabase:", dbErr);
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
