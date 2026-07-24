# Maternelle Connect - Proxy Vercel & Dashboard

Point d’entrée unique pour l’API Maternelle Connect et interface d’administration.

## Fonctionnalités

- **Proxy API** : redirige `/api/*` vers le backend Render.
- **Authentification** sécurisée par clé admin.
- **Dashboard** complet : statistiques, patientes, hôpitaux, alertes, carte, règles, FAQ, quiz, conseils.
- **Design responsive** (Bootstrap 5).
- Déploiement instantané sur Vercel.

## Structure
```
├── api/
│ └── [[...path]].js # Middleware Edge
├── public/
│ └── index.html # Dashboard SPA
├── vercel.json # Configuration Vercel
└── README.md
```
## Déploiement

1. Forker ce dépôt.
2. Connecter Vercel à votre GitHub.
3. Définir la variable d’environnement `RENDER_API_URL` (URL de votre backend Render).
4. Déployer.

L’URL Vercel devient votre point d’accès public pour l’application mobile et le dashboard.

## Sécurité

- Le middleware transmet uniquement les headers nécessaires au backend.
- La clé admin est stockée dans le navigateur et envoyée avec chaque requête admin.
- Les endpoints publics (chat, hôpitaux) ne nécessitent pas de clé.
