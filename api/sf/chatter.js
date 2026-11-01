// La SEULE écriture permise dans Salesforce : une question Chatter sur une Opportunity.
// GET  /api/sf/chatter                → qui publie (utilisateur d'intégration) et combien de posts aujourd'hui
// POST /api/sf/chatter  { "oppId": "006...", "texte": "...", "mentions": ["005..."], "essai": false }
// Garde-fous (codés ici, pas seulement dans le prompt) :
//   - cible : une Opportunity (Id 006…) seulement ;
//   - mentions : uniquement les utilisateurs de VIGIE_CHATTER_MENTIONS (par défaut Bianka, Rosalie, Sarah) ;
//   - texte : 15 à 1000 caractères, sans lien ; préfixe imposé « 🔎 <VIGIE_CHATTER_NOM>, de la part de JF… » ;
//   - au plus VIGIE_CHATTER_MAX posts par jour (défaut 6) et un seul par dossier par jour ;
//   - "essai": true valide tout et renvoie le post sans le publier.
import { autorise, refuser, lireCorps } from "../../lib/auth.js";

const API = "v61.0";
const NOM = (process.env.VIGIE_CHATTER_NOM || "Fouinard").trim().slice(0, 40);
const MARQUEUR = `🔎 ${NOM}, de la part de JF (pas pressant, quand tu as 2 minutes) : `;
const SIGNE = "de la part de JF (pas pressant";
const MENTIONS_DEFAUT = "00541000002yXD5AAM,0051K000008fQ64QAE,00541000001SYy5AAG";
let jeton = null;

function config() {
  let instance = (process.env.SF_RO_INSTANCE_URL || "").trim().replace(/\/+$/, "");
  if (instance && !/^https?:\/\//i.test(instance)) instance = `https://${instance}`;
  return { instance, id: process.env.SF_RO_CLIENT_ID || "", secret: process.env.SF_RO_CLIENT_SECRET || "" };
}

async function obtenirJeton(forcer = false) {
  const c = config();
  if (!c.instance || !c.id || !c.secret) throw Object.assign(new Error("Variables SF_RO_* manquantes"), { statut: 503, code: "config_manquante" });
  if (!forcer && jeton && Date.now() - jeton.obtenuLe < 45 * 60 * 1000) return jeton;
  const rep = await fetch(`${c.instance}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: c.id, client_secret: c.secret }).toString(),
  });
  const d = await rep.json().catch(() => ({}));
  if (!rep.ok || !d.access_token) throw Object.assign(new Error(d.error_description || "Échec du jeton Salesforce"), { statut: 502, code: d.error || "jeton" });
  jeton = { valeur: d.access_token, instance: d.instance_url || c.instance, obtenuLe: Date.now() };
  return jeton;
}

async function sf(chemin, options = {}, deuxieme = false) {
  const j = await obtenirJeton(deuxieme);
  const rep = await fetch(`${j.instance}${chemin}`, {
    ...options,
    headers: { Authorization: `Bearer ${j.valeur}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (rep.status === 401 && !deuxieme) return sf(chemin, options, true);
  const d = await rep.json().catch(() => null);
  if (!rep.ok) {
    const e = Array.isArray(d) && d[0] ? d[0] : {};
    throw Object.assign(new Error(e.message || `Salesforce HTTP ${rep.status}`), { statut: rep.status === 400 ? 400 : 502, code: e.errorCode || "salesforce" });
  }
  return d;
}

const q = (s) => sf(`/services/data/${API}/query?q=${encodeURIComponent(s)}`);

async function moi() {
  const u = await sf(`/services/data/${API}/chatter/users/me`);
  return { id: u.id, nom: u.name };
}

async function postsDuJour(idMoi) {
  const d = await q(`SELECT Id, ParentId, Body FROM FeedItem WHERE CreatedById = '${idMoi}' AND CreatedDate = TODAY AND Type = 'TextPost' ORDER BY CreatedDate DESC LIMIT 200`);
  return (d.records || []).filter((r) => String(r.ParentId || "").startsWith("006") && String(r.Body || "").includes(SIGNE));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!autorise(req)) return refuser(res);
  const max = Math.max(1, Math.min(20, parseInt(process.env.VIGIE_CHATTER_MAX || "6", 10) || 6));
  try {
    const u = await moi();
    const duJour = await postsDuJour(u.id);

    if (req.method === "GET") {
      return res.status(200).json({ publiePar: u, postesAujourdhui: duJour.length, maxParJour: max, dossiersAujourdhui: duJour.map((r) => r.ParentId) });
    }
    if (req.method !== "POST") return res.status(405).json({ erreur: "methode" });

    const b = await lireCorps(req);
    const oppId = String(b.oppId || "").trim();
    const texte = String(b.texte || "").trim();
    const permis = new Set((process.env.VIGIE_CHATTER_MENTIONS || MENTIONS_DEFAUT).split(",").map((x) => x.trim()).filter(Boolean));
    const mentions = [...new Set((Array.isArray(b.mentions) ? b.mentions : []).map((x) => String(x).trim()))];

    if (!/^006[A-Za-z0-9]{12}([A-Za-z0-9]{3})?$/.test(oppId)) return res.status(400).json({ erreur: "cible_refusee", message: "Seule une Opportunity (Id 006…) peut recevoir un post." });
    if (texte.length < 15 || texte.length > 1000) return res.status(400).json({ erreur: "texte", message: "Le texte doit faire entre 15 et 1000 caractères." });
    if (/https?:\/\/|www\./i.test(texte)) return res.status(400).json({ erreur: "texte", message: "Aucun lien permis dans le texte." });
    const refusees = mentions.filter((m) => ![...permis].some((p) => p.slice(0, 15) === m.slice(0, 15)));
    if (!mentions.length || refusees.length) return res.status(403).json({ erreur: "mention_refusee", message: `Mention(s) hors liste : ${refusees.join(", ") || "(aucune mention fournie)"}` });
    if (duJour.length >= max) return res.status(429).json({ erreur: "quota", message: `Déjà ${duJour.length} posts aujourd'hui (max ${max}).` });
    if (duJour.some((r) => r.ParentId.slice(0, 15) === oppId.slice(0, 15))) return res.status(409).json({ erreur: "deja_poste", message: "Une question a déjà été postée sur ce dossier aujourd'hui." });

    const opp = await q(`SELECT Id FROM Opportunity WHERE Id = '${oppId}' LIMIT 1`);
    if (!opp.records?.length) return res.status(404).json({ erreur: "introuvable", message: "Opportunity introuvable." });

    const segments = [];
    for (const m of mentions) {
      segments.push({ type: "Mention", id: m });
      segments.push({ type: "Text", text: " " });
    }
    segments.push({ type: "Text", text: MARQUEUR + texte });
    const corps = { feedElementType: "FeedItem", subjectId: oppId, body: { messageSegments: segments } };

    if (b.essai === true) return res.status(200).json({ essai: true, publierait: { par: u.nom, oppId, mentions, texte: MARQUEUR + texte }, postesAujourdhui: duJour.length, maxParJour: max });

    const r = await sf(`/services/data/${API}/chatter/feed-elements`, { method: "POST", body: JSON.stringify(corps) });
    return res.status(201).json({ publie: true, id: r.id, par: u.nom, oppId, postesAujourdhui: duJour.length + 1, maxParJour: max });
  } catch (e) {
    return res.status(e.statut || 500).json({ erreur: e.code || "interne", message: e.message });
  }
}
