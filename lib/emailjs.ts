import type Stripe from "stripe";
import { hasBeenNotified, markAsNotified } from "./alerts-store";

export interface EmailJsConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
  privateKey?: string;
  adminEmail?: string;
  isConfigured: boolean;
}

export function getEmailJsConfig(): EmailJsConfig {
  const serviceId = process.env.EMAILJS_SERVICE_ID?.trim() || "";
  const templateId = process.env.EMAILJS_TEMPLATE_ID?.trim() || "";
  const publicKey = (process.env.EMAILJS_PUBLIC_KEY || process.env.EMAILJS_USER_ID)?.trim() || "";
  const privateKey = (process.env.EMAILJS_PRIVATE_KEY || process.env.EMAILJS_ACCESS_TOKEN)?.trim() || undefined;
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL?.trim() || "Wissem95220@icloud.com";

  const isConfigured = Boolean(serviceId && templateId && publicKey);

  return {
    serviceId,
    templateId,
    publicKey,
    privateKey,
    adminEmail,
    isConfigured,
  };
}

export interface PaymentAlertPayload {
  order_reference: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  tiktok_username: string;
  article_name: string;
  amount: string;
  shipping_cost: string;
  total_amount: string;
  shipping_address: string;
  stripe_session_id: string;
  payment_intent_id: string;
  date: string;
  to_email?: string;
  [key: string]: string | undefined;
}

function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || isNaN(cents)) return "0,00 €";
  return (
    (cents / 100).toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

export async function sendEmailJsAlert(
  params: PaymentAlertPayload
): Promise<{ success: boolean; message: string; error?: string }> {
  const config = getEmailJsConfig();

  if (!config.isConfigured) {
    const missing: string[] = [];
    if (!config.serviceId) missing.push("EMAILJS_SERVICE_ID");
    if (!config.templateId) missing.push("EMAILJS_TEMPLATE_ID");
    if (!config.publicKey) missing.push("EMAILJS_PUBLIC_KEY");

    return {
      success: false,
      message: `Configuration EmailJS incomplète. Variables manquantes : ${missing.join(", ")}`,
      error: "MISSING_CONFIG",
    };
  }

  const formattedSummary = `
Nouvelle Commande Live Showroom :
• Référence : ${params.order_reference}
• Date : ${params.date}
• Pseudo TikTok : ${params.tiktok_username}
• Client(e) : ${params.customer_name} (${params.customer_email} / ${params.customer_phone})
• Article : ${params.article_name}
• Montant article : ${params.amount}
• Frais de port : ${params.shipping_cost}
• TOTAL PAYÉ : ${params.total_amount}

ADRESSE DE LIVRAISON (Mondial Relay) :
${params.shipping_address}

ID Session Stripe : ${params.stripe_session_id}
`.trim();

  const payload: Record<string, unknown> = {
    service_id: config.serviceId,
    template_id: config.templateId,
    user_id: config.publicKey,
    template_params: {
      ...params,
      message: formattedSummary,
      from_name: params.customer_name || "Oh My Dress Live",
      to_name: "Admin Oh My Dress",
      reply_to: params.customer_email || "",
      to_email: config.adminEmail || params.to_email || "",
      admin_email: config.adminEmail || "",
    },
  };

  if (config.privateKey) {
    payload.accessToken = config.privateKey;
  }

  try {
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (response.ok) {
      return {
        success: true,
        message: "Alerte envoyée avec succès via EmailJS.",
      };
    } else {
      console.error("Erreur de l'API EmailJS:", response.status, responseText);
      return {
        success: false,
        message: `Erreur EmailJS (${response.status}) : ${responseText || "Échec de l'envoi"}`,
        error: responseText,
      };
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Erreur réseau inconnue";
    console.error("Exception lors de l'appel EmailJS:", error);
    return {
      success: false,
      message: `Impossible de contacter l'API EmailJS: ${errorMsg}`,
      error: errorMsg,
    };
  }
}

export async function sendPaymentAlert(
  session: Stripe.Checkout.Session
): Promise<{ success: boolean; message: string; skipped?: boolean }> {
  if (!session || !session.id) {
    return { success: false, message: "Session Stripe invalide." };
  }

  // Deduplication check
  if (hasBeenNotified(session.id)) {
    return {
      success: true,
      skipped: true,
      message: "Cette notification a déjà été transmise.",
    };
  }

  const meta = session.metadata || {};
  const customerDetails = session.customer_details;

  const totalAmountFormatted = formatCents(session.amount_total);
  const customAmountFormatted = meta.custom_amount
    ? `${parseFloat(meta.custom_amount).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`
    : totalAmountFormatted;
  const shippingFormatted = meta.shipping_cost
    ? `${parseFloat(meta.shipping_cost).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`
    : "5,00 €";

  const customerName =
    meta.customer_name || customerDetails?.name || "Client Oh My Dress";
  const customerEmail =
    meta.customer_email || customerDetails?.email || session.customer_email || "Non renseigné";
  const customerPhone =
    meta.customer_phone || customerDetails?.phone || "Non renseigné";
  const tiktokUsername = meta.tiktok_username
    ? `@${meta.tiktok_username.replace(/^@/, "")}`
    : "Non renseigné";
  const orderRef = meta.order_reference || "Réf. inconnue";
  const articleName = meta.article_name || "Commande Live Showroom";
  const shippingAddress = meta.shipping_address || "Non renseignée";
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || "N/A";

  const dateStr = new Date(
    session.created ? session.created * 1000 : Date.now()
  ).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const payload: PaymentAlertPayload = {
    order_reference: orderRef,
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: customerPhone,
    tiktok_username: tiktokUsername,
    article_name: articleName,
    amount: customAmountFormatted,
    shipping_cost: shippingFormatted,
    total_amount: totalAmountFormatted,
    shipping_address: shippingAddress,
    stripe_session_id: session.id,
    payment_intent_id: paymentIntentId,
    date: dateStr,
  };

  const result = await sendEmailJsAlert(payload);

  if (result.success) {
    markAsNotified(session.id);
  }

  return result;
}

export async function sendTestAlert(): Promise<{ success: boolean; message: string; error?: string }> {
  const dateStr = new Date().toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const payload: PaymentAlertPayload = {
    order_reference: "TEST-OMD-001",
    customer_name: "Test Client (Exemple)",
    customer_email: "test-client@example.com",
    customer_phone: "06 12 34 56 78",
    tiktok_username: "@test.mode",
    article_name: "Robe de soirée modèle Éclipse",
    amount: "45,00 €",
    shipping_cost: "5,00 €",
    total_amount: "50,00 €",
    shipping_address: "12 Avenue des Champs-Élysées, 75008 Paris, FR",
    stripe_session_id: "cs_test_mock_session_12345",
    payment_intent_id: "pi_test_mock_intent_67890",
    date: dateStr,
  };

  return sendEmailJsAlert(payload);
}
