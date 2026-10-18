import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth";
import { sendTestAlert } from "@/lib/emailjs";

export async function POST() {
  const isAuth = await verifyAdminSession();
  if (!isAuth) {
    return NextResponse.json(
      { error: "Accès refusé. Veuillez vous connecter." },
      { status: 401 }
    );
  }

  try {
    const result = await sendTestAlert();
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    console.error("Erreur lors de l'envoi de l'alerte test EmailJS:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Une erreur inattendue est survenue lors de l'envoi du test.",
        error: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}
