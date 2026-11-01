// Contrôle d'accès commun : en-tête x-vigie-cle comparé à VIGIE_API_KEY (temps constant).
import { timingSafeEqual, createHash } from "node:crypto";

export function autorise(req) {
  const attendue = process.env.VIGIE_API_KEY || "";
  const recue = String(req.headers["x-vigie-cle"] || "");
  if (attendue.length < 32 || !recue) return false;
  const a = createHash("sha256").update(attendue).digest();
  const b = createHash("sha256").update(recue).digest();
  return timingSafeEqual(a, b);
}

export function refuser(res) {
  res.status(401).json({ erreur: "cle_invalide", message: "En-tête x-vigie-cle absent ou invalide." });
}

export async function lireCorps(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}
