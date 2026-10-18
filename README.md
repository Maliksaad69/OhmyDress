# Oh My Dress Showroom — Plateforme de Paiement TikTok Live

Plateforme de paiement direct et de gestion des ventes exclusives TikTok pour le showroom Oh My Dress. Intègre le règlement sécurisé par carte bancaire via Stripe, un panneau d'administration pour suivre les paiements en direct, et les alertes automatiques par e-mail via EmailJS.

---

## Fonctionnalités

- **Tunnel de Paiement Client** :
  - Montant libre convenu lors du live TikTok.
  - Saisie de la référence de commande et du pseudo TikTok.
  - Adresse de livraison complète pour Mondial Relay.
  - Redirection et paiement 100% sécurisé via Stripe Checkout.
  - Page de confirmation personnalisée avec récapitulatif de commande.

- **Panneau d'Administration (`/admin`)** :
  - Authentification sécurisée par mot de passe.
  - Indicateurs clés en temps réel (Chiffre d'affaires total et du jour, nombre de commandes, panier moyen, paniers abandonnés/en cours).
  - Tableau interactif avec recherche instantanée (par nom, pseudo TikTok, email, référence).
  - Filtres par statut (Payés, En attente, Expirés) et tri par date / montant.
  - Fiche détaillée de commande avec copie en 1 clic de l'adresse de livraison pour bordereau Mondial Relay et du pseudo TikTok.
  - Export CSV complet pour la préparation des expéditions et la comptabilité.
  - Lien direct vers chaque paiement dans le Dashboard Stripe officiel.

- **Alertes Automatiques EmailJS** :
  - Notification automatique reçue par e-mail dès qu'une cliente finalise son règlement.
  - Déduplication intelligente pour éviter les e-mails en double.
  - Onglet dédié dans l'administration pour vérifier la configuration et tester l'envoi d'e-mails en 1 clic.

---

## Configuration de l'Environnement

Créez ou modifiez le fichier `.env` à la racine du projet :

```env
# Stripe
STRIPE_SECRET_KEY=rk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Sécurité Espace Admin (/admin)
ADMIN_PASSWORD=admin2026

# EmailJS (https://www.emailjs.com)
EMAILJS_SERVICE_ID=service_xxxxxxx
EMAILJS_TEMPLATE_ID=template_xxxxxxx
EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxxxx
ADMIN_NOTIFICATION_EMAIL=contact@ohmydress.fr
```

### Variables du Modèle EmailJS

Dans votre tableau de bord EmailJS (section **Email Templates**), vous pouvez insérer ces balises dans le contenu de l'e-mail d'alerte :

- `{{order_reference}}` : Référence de la commande (ex : `OMD-LIVE-4982`)
- `{{tiktok_username}}` : Compte TikTok de la cliente (ex : `@laura.style`)
- `{{customer_name}}` : Nom complet du destinataire
- `{{customer_phone}}` : Téléphone pour le suivi Mondial Relay
- `{{customer_email}}` : Adresse e-mail de la cliente
- `{{article_name}}` : Nom de la pièce convenue lors du live
- `{{amount}}` : Montant de l'article (ex : `45,00 €`)
- `{{shipping_cost}}` : Frais de livraison (ex : `5,00 €`)
- `{{total_amount}}` : Montant total payé (ex : `50,00 €`)
- `{{shipping_address}}` : Adresse postale complète de livraison
- `{{stripe_session_id}}` : Identifiant de la session Stripe
- `{{date}}` : Date et heure du paiement

---

## Démarrage Rapide

```bash
# Installation des dépendances
npm install

# Démarrage en mode développement
npm run dev

# Construction pour la production
npm run build
npm run start
```

- Boutique & Paiement : [http://localhost:3000](http://localhost:3000)
- Panneau d'Administration : [http://localhost:3000/admin](http://localhost:3000/admin) (mot de passe par défaut : `admin2026`)
