// GET /api/sante — indique quelles pièces sont configurées, sans jamais révéler de valeur.
import { autorise, refuser } from "../lib/auth.js";
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!autorise(req)) return refuser(res);
  const e = process.env;
  res.status(200).json({
    ok: true,
    salesforce: Boolean(e.SF_RO_INSTANCE_URL && e.SF_RO_CLIENT_ID && e.SF_RO_CLIENT_SECRET),
    courriel: Boolean(e.AZURE_TENANT_ID && e.AZURE_CLIENT_ID && e.AZURE_CLIENT_SECRET && e.VIGIE_EXPEDITEUR),
    destinataires: (e.VIGIE_DESTINATAIRES || "").split(",").filter(Boolean).length,
    heure: new Date().toISOString(),
  });
}
