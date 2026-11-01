// POST /api/alerte  { "a": ["..."], "cc": ["..."], "sujet": "...", "corps": "<p>html</p>", "niveau": "rouge|jaune|bilan" }
// Envoie depuis VIGIE_EXPEDITEUR (vigie@credityamaska.com) par Microsoft Graph.
// Garde-fous : destinataires limités à VIGIE_DESTINATAIRES ; VIGIE_COPIE_TOUJOURS ajouté en copie à chaque envoi.
import { autorise, refuser, lireCorps } from "../lib/auth.js";
import { obtenirJetonGraph } from "../lib/graph.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!autorise(req)) return refuser(res);
  if (req.method !== "POST") return res.status(405).json({ erreur: "methode" });

  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, VIGIE_EXPEDITEUR } = process.env;
  if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET || !VIGIE_EXPEDITEUR) {
    return res.status(503).json({ erreur: "envoi_non_configure", message: "Variables AZURE_* ou VIGIE_EXPEDITEUR manquantes." });
  }

  const b = await lireCorps(req);
  const permis = new Set(liste(process.env.VIGIE_DESTINATAIRES));
  const copieToujours = liste(process.env.VIGIE_COPIE_TOUJOURS);
  const a = liste((b.a || []).join(","));
  const cc = [...new Set([...liste((b.cc || []).join(",")), ...copieToujours])].filter((x) => !a.includes(x));
  const sujet = String(b.sujet || "").slice(0, 250);
  const corps = String(b.corps || "");

  if (!a.length || !sujet || !corps) return res.status(400).json({ erreur: "champs", message: "a, sujet et corps sont obligatoires." });
  const horsListe = [...a, ...cc].filter((x) => !permis.has(x));
  if (horsListe.length) return res.status(403).json({ erreur: "destinataire_refuse", message: `Hors de la liste permise : ${horsListe.join(", ")}` });
  if (corps.length > 200000) return res.status(400).json({ erreur: "corps_trop_long" });

  try {
    const jeton = await obtenirJetonGraph();
    const rep = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(VIGIE_EXPEDITEUR)}/sendMail`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: sujet,
          body: { contentType: "HTML", content: corps },
          toRecipients: a.map((x) => ({ emailAddress: { address: x } })),
          ccRecipients: cc.map((x) => ({ emailAddress: { address: x } })),
          importance: b.niveau === "rouge" ? "high" : "normal",
        },
        saveToSentItems: true,
      }),
    });
    if (rep.status !== 202) {
      const d = await rep.json().catch(() => ({}));
      return res.status(502).json({ erreur: "graph", statut: rep.status, message: d?.error?.message || "Échec de l'envoi" });
    }
    return res.status(200).json({ envoye: true, a, cc });
  } catch (e) {
    return res.status(e.statut || 500).json({ erreur: e.code || "interne", message: e.message });
  }
}
