# vigie-api

Passerelle de la **Vigie Salesforce** de Crédit Yamaska. Utilisée par l'agent Vigie (Claude, Platform Anthropic) pour :

- lire l'org Salesforce `matlex` en **lecture seule** (requêtes SELECT seulement) ;
- envoyer les alertes par courriel depuis `vigie@credityamaska.com`.

Toutes les routes exigent l'en-tête `x-vigie-cle` (valeur de `VIGIE_API_KEY`).

| Route | Méthode | Rôle |
|---|---|---|
| `/api/sante` | GET | Indique quelles pièces sont configurées, sans révéler de valeur |
| `/api/sf/query?q=SELECT…` | GET / POST | Requête SOQL lecture seule (max 10 pages) |
| `/api/alerte` | POST | Courriel `{a, cc, sujet, corps, niveau}` |

## Garde-fous

- Envoi limité aux adresses de `VIGIE_DESTINATAIRES` ; `VIGIE_COPIE_TOUJOURS` est ajouté en copie à chaque envoi.
- Côté Microsoft, l'app Entra « Vigie Salesforce – envoi courriels » (Mail.Send) est restreinte à la boîte `vigie@` par une Application Access Policy sur le groupe de sécurité « Vigie - envoi autorise ».
- Côté Salesforce, l'External Client App « Claude Cowork API » (Client Credentials).

## Variables d'environnement (Vercel, Production)

`VIGIE_API_KEY`, `SF_RO_INSTANCE_URL`, `SF_RO_CLIENT_ID`, `SF_RO_CLIENT_SECRET`,
`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`,
`VIGIE_EXPEDITEUR`, `VIGIE_DESTINATAIRES`, `VIGIE_COPIE_TOUJOURS`.

Le secret client Azure expire 24 mois après sa création (1er nov. 2026) : le renouveler avant, sinon les alertes cessent.

Responsable : J-F Chaput.
