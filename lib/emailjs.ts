import type Stripe from "stripe";
import { hasBeenNotified, markAsNotified } from "./alerts-store";
import { getPaymentBySessionId } from "./supabase";

export interface EmailJsConfig {
  serviceId: string;
  templateId: string;
  customerTemplateId?: string;
  publicKey: string;
  privateKey?: string;
  adminEmail: string;
  isConfigured: boolean;
}

export function getEmailJsConfig(): EmailJsConfig {
  const serviceId = process.env.EMAILJS_SERVICE_ID?.trim() || "";
  const templateId = process.env.EMAILJS_TEMPLATE_ID?.trim() || "";
  const customerTemplateId = process.env.EMAILJS_CUSTOMER_TEMPLATE_ID?.trim() || templateId;
  const publicKey = (process.env.EMAILJS_PUBLIC_KEY || process.env.EMAILJS_USER_ID)?.trim() || "";
  const privateKey = (process.env.EMAILJS_PRIVATE_KEY || process.env.EMAILJS_ACCESS_TOKEN)?.trim() || undefined;
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL?.trim() || "Wissem95220@icloud.com";

  const isConfigured = Boolean(serviceId && templateId && publicKey);

  return {
    serviceId,
    templateId,
    customerTemplateId,
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

/**
 * Low-level sender for a single EmailJS transmission.
 */
export async function sendEmailJsMessage(options: {
  toEmail: string;
  toName: string;
  fromName: string;
  replyTo: string;
  subject?: string;
  message: string;
  templateId?: string;
  orderParams: PaymentAlertPayload;
}): Promise<{ success: boolean; message: string; error?: string }> {
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

  const chosenTemplateId = options.templateId || config.templateId;

  // Provide all common template parameter names so any template setup works effortlessly
  const payload: Record<string, unknown> = {
    service_id: config.serviceId,
    template_id: chosenTemplateId,
    user_id: config.publicKey,
    template_params: {
      ...options.orderParams,
      message: options.message,
      to_email: options.toEmail,
      recipient_email: options.toEmail,
      customer_email: options.orderParams.customer_email || options.toEmail,
      email: options.toEmail,
      to_name: options.toName,
      from_name: options.fromName,
      reply_to: options.replyTo,
      admin_email: config.adminEmail,
      subject: options.subject || `Confirmation de commande — ${options.orderParams.order_reference}`,
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
        message: `E-mail envoyé avec succès à ${options.toEmail} via EmailJS.`,
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

/**
 * Backward compatibility wrapper.
 */
export async function sendEmailJsAlert(
  params: PaymentAlertPayload
): Promise<{ success: boolean; message: string; error?: string }> {
  const config = getEmailJsConfig();
  const targetEmail = params.to_email || config.adminEmail;

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

  return sendEmailJsMessage({
    toEmail: targetEmail,
    toName: params.customer_name || "Client Oh My Dress",
    fromName: "Oh My Dress Showroom",
    replyTo: params.customer_email || config.adminEmail,
    message: formattedSummary,
    orderParams: params,
  });
}

/**
 * Main payment notification dispatcher.
 * Sends confirmation email to the paying customer AND notification email to the admin.
 */
export async function sendPaymentAlert(
  session: Stripe.Checkout.Session
): Promise<{ success: boolean; message: string; skipped?: boolean }> {
  if (!session || !session.id) {
    return { success: false, message: "Session Stripe invalide." };
  }

  // 1. Fast in-memory / local deduplication check
  if (hasBeenNotified(session.id)) {
    return {
      success: true,
      skipped: true,
      message: "Cette notification a déjà été transmise.",
    };
  }

  // 2. Database deduplication check (if Supabase is configured)
  try {
    const existing = await getPaymentBySessionId(session.id);
    if (existing?.email_alert_sent) {
      markAsNotified(session.id);
      return {
        success: true,
        skipped: true,
        message: "Notification déjà enregistrée dans la base de données.",
      };
    }
  } catch {
    // Non-blocking, continue
  }

  const config = getEmailJsConfig();
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
    meta.customer_name || customerDetails?.name || "Cliente Oh My Dress";
  const customerEmail =
    meta.customer_email || customerDetails?.email || session.customer_email || "";
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

  const results: { recipient: string; success: boolean; error?: string }[] = [];

  // Message récapitulatif pour la confirmation CLIENT
  const customerMessage = `
Bonjour ${customerName},

Votre commande a été confirmée avec succès ! Nous vous remercions pour votre confiance et pour votre achat lors de notre live TikTok Showroom.

RÉCAPITULATIF DE VOTRE COMMANDE :
• Référence de commande : ${orderRef}
• Date : ${dateStr}
• Pseudo TikTok : ${tiktokUsername}
• Article : ${articleName}
• Montant article : ${customAmountFormatted}
• Frais de livraison (Mondial Relay) : ${shippingFormatted}
• MONTANT TOTAL RÉGLÉ : ${totalAmountFormatted}

ADRESSE DE LIVRAISON SÉLECTIONNÉE :
${shippingAddress}

Le showroom Oh My Dress prépare votre colis avec le plus grand soin. Votre numéro de suivi Mondial Relay vous sera envoyé par e-mail dès l'expédition.

Pour toute question concernant votre commande, vous pouvez nous répondre directement à cet e-mail ou nous contacter sur notre live TikTok.

Merci et à très bientôt chez Oh My Dress !
`.trim();

  // Message récapitulatif pour l'alerte VENDEUR / ADMIN
  const adminMessage = `
Nouvelle Commande Live Showroom :
• Référence : ${orderRef}
• Date : ${dateStr}
• Pseudo TikTok : ${tiktokUsername}
• Client(e) : ${customerName} (${customerEmail} / ${customerPhone})
• Article : ${articleName}
• Montant article : ${customAmountFormatted}
• Frais de port : ${shippingFormatted}
• TOTAL PAYÉ : ${totalAmountFormatted}

ADRESSE DE LIVRAISON (Mondial Relay) :
${shippingAddress}

ID Session Stripe : ${session.id}
`.trim();

  const isCustomerValidEmail = customerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customerEmail);
  const isSameAsAdmin =
    isCustomerValidEmail &&
    config.adminEmail &&
    customerEmail.trim().toLowerCase() === config.adminEmail.trim().toLowerCase();

  // 1. Envoyer l'e-mail de confirmation au client
  if (isCustomerValidEmail) {
    const custRes = await sendEmailJsMessage({
      toEmail: customerEmail.trim(),
      toName: customerName,
      fromName: "Oh My Dress Showroom",
      replyTo: config.adminEmail,
      subject: `Confirmation de votre commande ${orderRef} — Oh My Dress`,
      message: customerMessage,
      templateId: config.customerTemplateId || config.templateId,
      orderParams: payload,
    });
    results.push({ recipient: `Customer (${customerEmail})`, success: custRes.success, error: custRes.error });
  }

  // 2. Envoyer l'e-mail d'alerte à l'administrateur (si adresse différente)
  if (config.adminEmail && !isSameAsAdmin) {
    const adminRes = await sendEmailJsMessage({
      toEmail: config.adminEmail.trim(),
      toName: "Admin Oh My Dress",
      fromName: customerName ? `${customerName} (TikTok Showroom)` : "Oh My Dress Live",
      replyTo: customerEmail || config.adminEmail,
      subject: `Nouvelle Commande Live : ${orderRef} (${totalAmountFormatted})`,
      message: adminMessage,
      templateId: config.templateId,
      orderParams: payload,
    });
    results.push({ recipient: `Admin (${config.adminEmail})`, success: adminRes.success, error: adminRes.error });
  }

  const atLeastOneSuccess = results.some((r) => r.success);

  if (atLeastOneSuccess) {
    markAsNotified(session.id);
    return {
      success: true,
      message: `Notification(s) envoyée(s) : ${results.map((r) => `${r.recipient} (${r.success ? "OK" : "Échec"})`).join(", ")}`,
    };
  } else {
    const errorDetails = results.map((r) => `${r.recipient}: ${r.error || "Échec"}`).join(" ; ");
    return {
      success: false,
      message: `Impossible d'envoyer l'e-mail de confirmation : ${errorDetails || "Aucun destinataire valide"}`,
    };
  }
}

export async function sendTestAlert(): Promise<{ success: boolean; message: string; error?: string }> {
  const config = getEmailJsConfig();
  const dateStr = new Date().toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const payload: PaymentAlertPayload = {
    order_reference: "TEST-OMD-001",
    customer_name: "Test Client (Exemple)",
    customer_email: config.adminEmail || "test-client@example.com",
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

  return sendEmailJsMessage({
    toEmail: config.adminEmail || "Wissem95220@icloud.com",
    toName: "Admin Oh My Dress",
    fromName: "Oh My Dress Live (Test)",
    replyTo: config.adminEmail || "Wissem95220@icloud.com",
    subject: "Test d'alerte EmailJS — Oh My Dress",
    message: `Test de transmission d'e-mail de commande réussi !\n\nCommande de test pour ${payload.article_name} (${payload.total_amount}).\nConfiguration EmailJS opérationnelle.`,
    templateId: config.templateId,
    orderParams: payload,
  });
}
