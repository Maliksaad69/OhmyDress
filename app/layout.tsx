import type { Metadata } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Paiement Sécurisé | Oh My Dress Showroom",
  description:
    "Finalisez votre commande passée lors de nos ventes exclusives TikTok. Paiement 100% sécurisé et expédition express.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      data-scroll-behavior="smooth"
      className={`${cormorant.variable} ${montserrat.variable} scroll-smooth`}
    >
      <body className="font-sans text-brand-charcoal antialiased min-h-screen flex flex-col justify-between selection:bg-brand-gold selection:text-white">
        {children}
      </body>
    </html>
  );
}
