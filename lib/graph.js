// Jeton Microsoft Graph (client credentials) partagé par les routes courriel et rapport.
let jetonGraph = null;

export function grapheConfigure() {
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;
  return Boolean(AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET);
}

export async function obtenirJetonGraph(forcer = false) {
  if (!forcer && jetonGraph && Date.now() - jetonGraph.obtenuLe < 45 * 60 * 1000) return jetonGraph.valeur;
  const { AZURE_TENANT_ID: t, AZURE_CLIENT_ID: id, AZURE_CLIENT_SECRET: s } = process.env;
  const rep = await fetch(`https://login.microsoftonline.com/${t}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: s, scope: "https://graph.microsoft.com/.default" }).toString(),
  });
  const d = await rep.json().catch(() => ({}));
  if (!rep.ok || !d.access_token) throw Object.assign(new Error(d.error_description || "Échec du jeton Microsoft"), { statut: 502, code: d.error || "jeton_graph" });
  jetonGraph = { valeur: d.access_token, obtenuLe: Date.now() };
  return jetonGraph.valeur;
}
