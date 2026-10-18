import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env
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

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("==========================================");
console.log("   VÉRIFICATION CONNEXION SUPABASE DB    ");
console.log("==========================================");
console.log(`URL Supabase : ${url || "❌ MANQUANTE"}`);
console.log(`Clé d'accès  : ${key ? key.substring(0, 16) + "..." : "❌ MANQUANTE"}`);
console.log("------------------------------------------");

if (!url || !key) {
  console.error("❌ Erreur : Identifiants Supabase absents dans le fichier .env");
  process.exit(1);
}

const client = createClient(url, key, { auth: { persistSession: false } });

try {
  const start = Date.now();
  console.log("Connexion à la table 'payments'...");
  const { error, status } = await client.from("payments").select("count").limit(1);
  const duration = Date.now() - start;

  if (error) {
    console.error(`❌ Échec de la requête (Code ${status}) :`, error.message);
    process.exit(1);
  }

  console.log(`✅ Connexion réussie en ${duration} ms (Code ${status} OK)`);

  // Test CRUD write
  const testId = "test_ping_" + Date.now();
  const { data: inserted, error: insertErr } = await client.from("payments").upsert({
    stripe_session_id: testId,
    order_reference: "TEST-PING",
    customer_name: "Diagnostic Supabase",
    amount: 10.0,
    shipping_cost: 5.0,
    total_amount: 15.0,
    payment_status: "paid",
  }).select();

  if (insertErr) {
    console.warn("⚠️ Attention (Écriture RLS) :", insertErr.message);
  } else {
    console.log("✅ Test d'écriture réussi (ID créé :", inserted[0]?.id, ")");
    await client.from("payments").delete().eq("stripe_session_id", testId);
    console.log("✅ Nettoyage automatique effectué.");
  }

  console.log("\n>>> BASE DE DONNÉES SUPABASE OPÉRATIONNELLE ET PRÊTE ! <<<");
} catch (err) {
  console.error("❌ Exception lors de la connexion :", err.message);
  process.exit(1);
}
