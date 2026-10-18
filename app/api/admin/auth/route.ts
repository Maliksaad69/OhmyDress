import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, generateAuthToken, validatePassword, verifyAdminSession } from "@/lib/auth";
import { getEmailJsConfig } from "@/lib/emailjs";

export async function GET(request: NextRequest) {
  void request.url;
  const authenticated = await verifyAdminSession();
  const emailJsConfig = getEmailJsConfig();

  return NextResponse.json({
    authenticated,
    emailJs: {
      isConfigured: emailJsConfig.isConfigured,
      hasServiceId: Boolean(emailJsConfig.serviceId),
      hasTemplateId: Boolean(emailJsConfig.templateId),
      hasPublicKey: Boolean(emailJsConfig.publicKey),
      hasPrivateKey: Boolean(emailJsConfig.privateKey),
      adminEmail: emailJsConfig.adminEmail || null,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const password = typeof body.password === "string" ? body.password : "";

    if (!password) {
      return NextResponse.json(
        { error: "Veuillez renseigner le mot de passe administrateur." },
        { status: 400 }
      );
    }

    const isValid = validatePassword(password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Mot de passe administrateur incorrect." },
        { status: 401 }
      );
    }

    const token = generateAuthToken();
    const response = NextResponse.json({
      success: true,
      message: "Connexion réussie.",
    });

    response.cookies.set(AUTH_COOKIE.name, token, AUTH_COOKIE.options);

    return response;
  } catch (error: unknown) {
    console.error("Erreur de connexion admin:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue lors de l'authentification." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: "Déconnexion réussie.",
  });

  response.cookies.delete(AUTH_COOKIE.name);
  return response;
}
