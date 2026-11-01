"""Installe l'assistant PretAI (bilan mensuel, suivi shadow, justifications Chatter) sur la Claude Platform.

Réutilise l'environnement et le coffre de la Vigie (vigie-platform-ids.json).
Usage : python3 deployer-pretai.py <dossier-des-secrets> [--activer-justifications] [--test bilan|shadow] [--essai-justifications]
  --test X                : lance tout de suite le déploiement X (envoie le vrai courriel à JF).
  --essai-justifications  : session ponctuelle en MODE ESSAI (aucun post, liste envoyée à JF).
  --activer-justifications: crée le déploiement planifié des justifications (à faire APRÈS avoir désactivé l'ancienne tâche).
Aucune valeur secrète n'est affichée.
"""
import json, os, sys, time, urllib.request, urllib.error

ICI = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pretai")
BASE = "https://api.anthropic.com/v1"
MODELE = "claude-sonnet-5-5"
TZ = "America/Toronto"
TACHES = {
    "bilan": {"nom": "PretAI — bilan mensuel du portefeuille", "cron": "5 8 1 * *", "fichier": "bilan.md", "budget": "300"},
    "shadow": {"nom": "PretAI — suivi shadow (9 dossiers)", "cron": "10 8 * * 1", "fichier": "shadow.md", "budget": "150"},
    "justifications": {"nom": "PretAI — questions Chatter sur les justifications", "cron": "5 7 * * 1-5", "fichier": "justifications.md", "budget": "300"},
}

dossier = sys.argv[1]
args = sys.argv[2:]

def lire(nom):
    with open(os.path.join(dossier, nom), "rb") as f:
        return f.read().decode("utf-8-sig")

CLE = [l.strip() for l in lire("vigie-secrets.txt").splitlines() if l.strip().startswith("sk-ant-")][0]
IDS_F = os.path.join(dossier, "vigie-platform-ids.json")
ids = json.load(open(IDS_F))

def sauver():
    json.dump(ids, open(IDS_F, "w"), indent=2)

def api(methode, chemin, corps=None):
    sep = "&" if "?" in chemin else "?"
    req = urllib.request.Request(f"{BASE}{chemin}{sep}beta=true", method=methode,
        data=json.dumps(corps).encode() if corps is not None else None,
        headers={"x-api-key": CLE, "anthropic-version": "2023-06-01",
                 "anthropic-beta": "managed-agents-2026-04-01", "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            t = r.read().decode()
            return json.loads(t) if t else {}
    except urllib.error.HTTPError as e:
        print(f"ERREUR {methode} {chemin} -> {e.code} : {e.read().decode().replace(CLE, '[CLE]')[:800]}")
        raise SystemExit(1)

def prompt(nom):
    return open(os.path.join(ICI, nom), encoding="utf-8").read()

def suivre(sid, maxi=60):
    for _ in range(maxi):
        time.sleep(20)
        s = api("GET", f"/sessions/{sid}")
        etat = s.get("status")
        if etat in ("idle", "terminated", "completed", "failed", "ended", "archived"):
            ev = api("GET", f"/sessions/{sid}/events?limit=1000").get("data", [])
            textes = [b.get("text", "") for e in ev if e.get("type", "").startswith("agent") for b in (e.get("content") or []) if isinstance(b, dict) and b.get("type") == "text"]
            print("session", sid, "état", etat, "| usage", json.dumps(s.get("usage") or s.get("stats") or {})[:300])
            print("--- dernier message ---"); print((textes[-1] if textes else "(aucun texte)")[:3500])
            return
    print("toujours en cours :", sid)

# Agent
systeme = prompt("systeme.md")
corps_agent = {"name": "PretAI — assistant de JF", "model": MODELE, "system": systeme, "tools": [{"type": "agent_toolset_20260401"}]}
if "pretai_agent" not in ids:
    r = api("POST", "/agents", corps_agent); ids["pretai_agent"] = r["id"]; ids["pretai_systeme_taille"] = len(systeme); sauver()
    print("agent créé :", r["id"])
elif ids.get("pretai_systeme_taille") != len(systeme):
    r = api("POST", f"/agents/{ids['pretai_agent']}", corps_agent); ids["pretai_systeme_taille"] = len(systeme); sauver()
    print("agent mis à jour, version", r.get("version"))
    for cle in TACHES:  # les déploiements sont épinglés à une version : on les rattache à la nouvelle
        if f"pretai_{cle}" in ids:
            api("POST", f"/deployments/{ids['pretai_' + cle]}", {"agent": {"type": "agent", "id": ids["pretai_agent"], "version": r.get("version")}})

def creer(cle):
    t = TACHES[cle]; k = f"pretai_{cle}"
    if k in ids:
        return
    r = api("POST", "/deployments", {"name": t["nom"], "agent": ids["pretai_agent"], "environment_id": ids["environnement"],
        "vault_ids": [ids["coffre"]],
        "initial_events": [{"type": "user.message", "content": [{"type": "text", "text": prompt(t["fichier"])}]}],
        "schedule": {"type": "cron", "expression": t["cron"], "timezone": TZ},
        "budget": {"type": "limit", "max_list_cost": {"amount": t["budget"], "currency": "USD"}}})
    ids[k] = r["id"]; sauver()
    print(f"déploiement {cle} :", r["id"], "| prochains :", ", ".join((r.get("schedule") or {}).get("upcoming_runs_at", [])[:2]))

creer("bilan"); creer("shadow")
if "--activer-justifications" in args:
    creer("justifications")

if "--test" in args:
    cle = args[args.index("--test") + 1]
    dep = ids[f"pretai_{cle}"]
    api("POST", f"/deployments/{dep}/run"); print(f"run « {cle} » lancé")
    for _ in range(15):
        time.sleep(10)
        runs = api("GET", f"/deployment_runs?deployment_id={dep}").get("data", [])
        if runs and runs[0].get("error"):
            print("échec :", json.dumps(runs[0]["error"])[:500]); break
        if runs and runs[0].get("session_id"):
            suivre(runs[0]["session_id"]); break

if "--essai-justifications" in args:
    s = api("POST", "/sessions", {"agent": ids["pretai_agent"], "environment_id": ids["environnement"], "vault_ids": [ids["coffre"]]})
    sid = s["id"]; print("session d'essai :", sid)
    api("POST", f"/sessions/{sid}/events", {"events": [{"type": "user.message", "content": [{"type": "text", "text": "MODE ESSAI\n\n" + prompt("justifications.md")}]}]})
    suivre(sid)
print("terminé.")
