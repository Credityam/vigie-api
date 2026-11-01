// GET  /api/sf/query?q=SELECT+Id+FROM+Lead+LIMIT+5
// POST /api/sf/query  { "q": "SELECT ..." }
// Ajouter &outil=tooling pour interroger l'API Tooling (FlowDefinition, ApexClass, ApexLog…), toujours en SELECT.
// Lecture seule : SELECT uniquement, via l'External Client App « Claude Cowork API »
// (flux Client Credentials). Ne journalise jamais les données retournées.
import { autorise, refuser, lireCorps } from "../../lib/auth.js";

const API = "v61.0";
const MAX_PAGES = 10;
let jeton = null; // { valeur, instance, obtenuLe }

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

function valider(q) {
  const s = String(q || "").trim();
  if (!s) return "Requête vide.";
  if (s.length > 20000) return "Requête trop longue.";
  if (!/^select\s/i.test(s)) return "Seules les requêtes SELECT sont permises.";
  if (s.includes(";")) return "Le caractère ; est interdit.";
  if (/\bfor\s+(update|view|reference)\b/i.test(s)) return "FOR UPDATE / VIEW / REFERENCE interdits.";
  return null;
}

async function getSF(chemin, deuxieme = false) {
  const j = await obtenirJeton(deuxieme);
  const rep = await fetch(`${j.instance}${chemin}`, { headers: { Authorization: `Bearer ${j.valeur}` } });
  if (rep.status === 401 && !deuxieme) return getSF(chemin, true);
  const d = await rep.json().catch(() => null);
  if (!rep.ok) {
    const e = Array.isArray(d) && d[0] ? d[0] : {};
    throw Object.assign(new Error(e.message || `Salesforce HTTP ${rep.status}`), { statut: rep.status === 400 ? 400 : 502, code: e.errorCode || "salesforce" });
  }
  return d;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!autorise(req)) return refuser(res);
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ erreur: "methode" });
  const corps = req.method === "POST" ? await lireCorps(req) : {};
  const q = req.method === "GET" ? req.query.q : corps.q;
  const tooling = (req.method === "GET" ? req.query.outil : corps.outil) === "tooling";
  const invalide = valider(q);
  if (invalide) return res.status(400).json({ erreur: "requete_refusee", message: invalide });
  try {
    let d = await getSF(`/services/data/${API}/${tooling ? "tooling/" : ""}query?q=${encodeURIComponent(String(q).trim())}`);
    const records = [...(d.records || [])];
    let pages = 1;
    while (!d.done && d.nextRecordsUrl && pages < MAX_PAGES) {
      d = await getSF(d.nextRecordsUrl);
      records.push(...(d.records || []));
      pages++;
    }
    return res.status(200).json({ totalSize: d.totalSize, done: d.done, returned: records.length, pages, records });
  } catch (e) {
    return res.status(e.statut || 500).json({ erreur: e.code || "interne", message: e.message });
  }
}
