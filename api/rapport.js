// Rapports de run dans SharePoint : site CreditYamaska, bibliothèque Partage, dossier VIGIE SALESFORCE.
// POST /api/rapport { "nom": "2026-11-02_matin.md", "contenu": "..." }  -> dépose (ou remplace) le fichier
// GET  /api/rapport?limite=20                                           -> liste les rapports les plus récents
// GET  /api/rapport?nom=2026-11-02_matin.md                             -> contenu d'un rapport
import { autorise, refuser, lireCorps } from "../lib/auth.js";
import { obtenirJetonGraph, grapheConfigure } from "../lib/graph.js";

// Identifiants SharePoint (non secrets) ; surchargeables par variables d'environnement.
const DRIVE = process.env.VIGIE_SP_DRIVE_ID || "b!ygaI10kPuESQYm00-KFwKkkSQWwIwz9Dnr-VKq-YCZEOdjbImOHNRrzldl3b2Gug";
const DOSSIER = process.env.VIGIE_SP_DOSSIER_ID || "01ER3CR5GFEUWORFK54FFK2TYJTYFW46OY";
const G = "https://graph.microsoft.com/v1.0";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!autorise(req)) return refuser(res);
  if (!grapheConfigure()) return res.status(503).json({ erreur: "graph_non_configure" });
  try {
    const r = await traiter(req, res, await obtenirJetonGraph());
    // Un jeton émis avant l'ajout d'une permission ne la contient pas : on en redemande un frais une fois.
    if (r === "refaire") await traiter(req, res, await obtenirJetonGraph(true), true);
  } catch (e) {
    return res.status(e.statut || 500).json({ erreur: e.code || "interne", message: e.message });
  }
}

async function traiter(req, res, jeton, dernierEssai = false) {
  {
    if (req.method === "GET" && req.query.nom) {
      const nom = String(req.query.nom);
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(md|html|txt)$/.test(nom)) return res.status(400).json({ erreur: "nom_invalide" });
      const rep = await fetch(`${G}/drives/${DRIVE}/items/${DOSSIER}:/${encodeURIComponent(nom)}:/content`, { headers: { Authorization: `Bearer ${jeton}` } });
      if (rep.status === 403 && !dernierEssai) return "refaire";
      if (rep.status === 404) return res.status(404).json({ erreur: "introuvable" });
      if (!rep.ok) return res.status(502).json({ erreur: "graph", statut: rep.status });
      return res.status(200).json({ nom, contenu: await rep.text() });
    }
    if (req.method === "GET") {
      const limite = Math.min(Math.max(parseInt(req.query.limite || "20", 10) || 20, 1), 200);
      const rep = await fetch(`${G}/drives/${DRIVE}/items/${DOSSIER}/children?$orderby=lastModifiedDateTime desc&$top=${limite}&$select=name,size,lastModifiedDateTime,webUrl`, {
        headers: { Authorization: `Bearer ${jeton}` },
      });
      const d = await rep.json().catch(() => ({}));
      if (rep.status === 403 && !dernierEssai) return "refaire";
      if (!rep.ok) return res.status(502).json({ erreur: "graph", statut: rep.status, message: d?.error?.message });
      return res.status(200).json({ rapports: (d.value || []).map((f) => ({ nom: f.name, taille: f.size, modifie: f.lastModifiedDateTime, url: f.webUrl })) });
    }
    if (req.method === "POST") {
      const b = await lireCorps(req);
      const nom = String(b.nom || "");
      const contenu = String(b.contenu || "");
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(md|html|txt)$/.test(nom)) {
        return res.status(400).json({ erreur: "nom_invalide", message: "Nom permis : lettres, chiffres, . _ -, extension .md, .html ou .txt." });
      }
      if (!contenu || contenu.length > 2_000_000) return res.status(400).json({ erreur: "contenu_invalide" });
      const type = nom.endsWith(".html") ? "text/html; charset=utf-8" : nom.endsWith(".md") ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8";
      const rep = await fetch(`${G}/drives/${DRIVE}/items/${DOSSIER}:/${encodeURIComponent(nom)}:/content`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${jeton}`, "Content-Type": type },
        body: contenu,
      });
      const d = await rep.json().catch(() => ({}));
      if (rep.status === 403 && !dernierEssai) return "refaire";
      if (!rep.ok) return res.status(502).json({ erreur: "graph", statut: rep.status, message: d?.error?.message });
      return res.status(200).json({ depose: true, nom: d.name, url: d.webUrl, taille: d.size });
    }
    return res.status(405).json({ erreur: "methode" });
  }
}
