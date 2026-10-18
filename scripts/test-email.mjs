import fs from "fs";
import path from "path";

// Load .env manually if needed
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const serviceId = process.env.EMAILJS_SERVICE_ID?.trim() || "";
const templateId = process.env.EMAILJS_TEMPLATE_ID?.trim() || "";
const publicKey = (process.env.EMAILJS_PUBLIC_KEY || process.env.EMAILJS_USER_ID)?.trim() || "";
const privateKey = (process.env.EMAILJS_PRIVATE_KEY || process.env.EMAILJS_ACCESS_TOKEN)?.trim() || undefined;
const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL?.trim() || "Wissem95220@icloud.com";

// Optional target email from CLI argument
const targetEmail = process.argv[2] || adminEmail;

console.log("==========================================");
console.log("   TEST D'ENVOI D'EMAIL AVEC EMAILJS      ");
console.log("==========================================");
console.log(`Service ID  : ${serviceId ? serviceId : "❌ MANQUANT"}`);
console.log(`Template ID : ${templateId ? templateId : "❌ MANQUANT"}`);
console.log(`Public Key  : ${publicKey ? publicKey.slice(0, 5) + "..." : "❌ MANQUANT"}`);
console.log(`Destinataire: ${targetEmail}`);
console.log("------------------------------------------");

if (!serviceId || !templateId || !publicKey) {
  console.error("\n❌ ERREUR : Les clés EmailJS ne sont pas configurées dans votre fichier .env");
  process.exit(1);
}

const testOrderRef = "OMD-TEST-" + Math.floor(1000 + Math.random() * 9000);
const dateStr = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

const customerMessage = `
Bonjour Wissem El Mhamedi,

Votre commande a été confirmée avec succès ! Nous vous remercions pour votre achat lors de notre live TikTok Showroom.

RÉCAPITULATIF DE VOTRE COMMANDE :
• Référence : ${testOrderRef}
• Date : ${dateStr}
• Pseudo TikTok : @wissem.live
• Article : Robe de Soirée Satin Doré - Showroom Live
• Montant article : 79,00 €
• Frais de port (Mondial Relay) : 5,00 €
• TOTAL RÉGLÉ : 84,00 €

ADRESSE DE LIVRAISON :
15 Rue de la Paix, 75002 Paris, France

Votre colis est en cours de préparation par l'équipe Oh My Dress.
`.trim();

const payload = {
  service_id: serviceId,
  template_id: templateId,
  user_id: publicKey,
  template_params: {
    order_reference: testOrderRef,
    customer_name: "Wissem El Mhamedi (Test)",
    customer_email: targetEmail,
    customer_phone: "+33 6 12 34 56 78",
    tiktok_username: "@wissem.live",
    article_name: "Robe de Soirée Satin Doré - Showroom Live",
    amount: "79,00 €",
    shipping_cost: "5,00 €",
    total_amount: "84,00 €",
    shipping_address: "15 Rue de la Paix, 75002 Paris, France",
    stripe_session_id: "cs_test_" + Math.random().toString(36).substring(2, 12),
    payment_intent_id: "pi_test_" + Math.random().toString(36).substring(2, 12),
    date: dateStr,
    to_email: targetEmail,
    recipient_email: targetEmail,
    email: targetEmail,
    admin_email: adminEmail,
    from_name: "Oh My Dress Showroom",
    to_name: "Wissem El Mhamedi",
    reply_to: adminEmail,
    subject: `Confirmation de votre commande ${testOrderRef} — Oh My Dress`,
    message: customerMessage,
  },
};

if (privateKey) {
  payload.accessToken = privateKey;
}

console.log("\nEnvoi de l'e-mail de confirmation via l'API EmailJS...");

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
    console.log(`✅ SUCCÈS ! L'e-mail de confirmation a été envoyé avec succès à : ${targetEmail}`);
    console.log("Statut de l'API EmailJS :", responseText);
  } else {
    console.error(`❌ ÉCHEC (${response.status}) :`, responseText);
  }
} catch (error) {
  console.error("❌ ERREUR RÉSEAU :", error.message);
}

