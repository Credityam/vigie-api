"""Installe la Vigie Salesforce sur la Claude Platform (Managed Agents).

Usage : python3 deployer.py <dossier-des-secrets> [--test matin|soir|robot]
Le dossier doit contenir vigie-secrets.txt (1re ligne : clé API Anthropic du workspace Vigie)
et vigie-api-vercel.txt (ligne VIGIE_API_KEY=...). Aucune valeur secrète n'est affichée.
Les identifiants créés sont écrits dans <dossier>/vigie-platform-ids.json ; relancer le script
réutilise ce qui existe déjà (idempotent) et met à jour l'agent si les prompts ont changé.
"""
import json, os, sys, time, urllib.request, urllib.error

ICI = os.path.dirname(os.path.abspath(__file__))
BASE = "https://api.anthropic.com/v1"
HOTE = "vigie-api-delta.vercel.app"
MODELE = "claude-sonnet-5-5"
BUDGET_CENTS = "300"  # 3 $ US maximum par run
TZ = "America/Toronto"
RUNS = {
    "matin": {"nom": "Vigie Salesforce — matin", "cron": "10 7 * * *", "fichier": "run-matin.md"},
    "soir": {"nom": "Vigie Salesforce — fin de journée", "cron": "10 18 * * *", "fichier": "run-soir.md"},
    "robot": {"nom": "Vigie Salesforce — robot PretAI", "cron": "25 17 * * 1-5", "fichier": "run-robot.md"},
}

dossier = sys.argv[1]
test = sys.argv[sys.argv.index("--test") + 1] if "--test" in sys.argv else None

def lire(nom):
    with open(os.path.join(dossier, nom), "rb") as f:
        return f.read().decode("utf-8-sig")

CLE = [l.strip() for l in lire("vigie-secrets.txt").splitlines() if l.strip().startswith("sk-ant-")][0]
CLE_VIGIE = [l.split("=", 1)[1].strip() for l in lire("vigie-api-vercel.txt").splitlines() if l.startswith("VIGIE_API_KEY=")][0]
IDS_F = os.path.join(dossier, "vigie-platform-ids.json")
ids = json.load(open(IDS_F)) if os.path.exists(IDS_F) else {}

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
        msg = e.read().decode().replace(CLE, "[CLE]").replace(CLE_VIGIE, "[CLE]")
        print(f"ERREUR {methode} {chemin} -> {e.code} : {msg[:800]}")
        raise SystemExit(1)

def prompt(nom):
    return open(os.path.join(ICI, nom), encoding="utf-8").read()

# 1. Environnement : réseau limité à la passerelle seulement.
if "environnement" not in ids:
    r = api("POST", "/environments", {"name": "vigie-salesforce", "config": {"type": "cloud",
        "networking": {"type": "limited", "allowed_hosts": [HOTE], "allow_package_managers": False}}})
    ids["environnement"] = r["id"]; sauver(); print("environnement créé :", r["id"])

# 2. Coffre : la clé de la passerelle, injectée seulement vers la passerelle.
if "coffre" not in ids:
    r = api("POST", "/vaults", {"display_name": "Vigie Salesforce", "metadata": {"responsable": "J-F Chaput"}})
    ids["coffre"] = r["id"]; sauver(); print("coffre créé :", r["id"])
    api("POST", f"/vaults/{ids['coffre']}/credentials", {"display_name": "Clé de la passerelle vigie-api",
        "auth": {"type": "environment_variable", "secret_name": "VIGIE_API_KEY", "secret_value": CLE_VIGIE,
                 "networking": {"type": "limited", "allowed_hosts": [HOTE]}, "injection_location": {"header": True}}})
    print("clé de la passerelle rangée dans le coffre")

# 3. Agent (créé, ou mis à jour si le prompt système a changé).
systeme = prompt("systeme.md")
corps_agent = {"name": "Vigie Salesforce", "model": MODELE, "system": systeme, "tools": [{"type": "agent_toolset_20260401"}]}
if "agent" not in ids:
    r = api("POST", "/agents", corps_agent)
    ids["agent"] = r["id"]; ids["agent_systeme_taille"] = len(systeme); sauver(); print("agent créé :", r["id"], "version", r.get("version"))
elif ids.get("agent_systeme_taille") != len(systeme):
    r = api("POST", f"/agents/{ids['agent']}", corps_agent)
    ids["agent_systeme_taille"] = len(systeme); sauver(); print("agent mis à jour, version", r.get("version"))
    for cle in RUNS:  # les déploiements sont épinglés à une version : on les rattache à la nouvelle
        if f"deploiement_{cle}" in ids:
            api("POST", f"/deployments/{ids['deploiement_' + cle]}", {"agent": {"type": "agent", "id": ids["agent"], "version": r.get("version")}})

# 4. Déploiements planifiés.
for cle, run in RUNS.items():
    k = f"deploiement_{cle}"
    if k in ids:
        continue
    r = api("POST", "/deployments", {"name": run["nom"], "agent": ids["agent"], "environment_id": ids["environnement"],
        "vault_ids": [ids["coffre"]],
        "initial_events": [{"type": "user.message", "content": [{"type": "text", "text": prompt(run["fichier"])}]}],
        "schedule": {"type": "cron", "expression": run["cron"], "timezone": TZ},
        "budget": {"type": "limit", "max_list_cost": {"amount": BUDGET_CENTS, "currency": "USD"}}})
    ids[k] = r["id"]; sauver()
    print(f"déploiement {cle} :", r["id"], "| prochains runs :", ", ".join((r.get("schedule") or {}).get("upcoming_runs_at", [])[:2]))

# 5. Run de test immédiat (optionnel), suivi jusqu'à la fin.
if test:
    dep = ids[f"deploiement_{test}"]
    api("POST", f"/deployments/{dep}/run")
    print(f"run de test « {test} » lancé ; suivi…")
    for _ in range(60):
        time.sleep(20)
        runs = api("GET", f"/deployment_runs?deployment_id={dep}").get("data", [])
        if not runs:
            continue
        dernier = runs[0]
        if dernier.get("error"):
            print("échec du run :", json.dumps(dernier["error"])[:500]); break
        sid = dernier.get("session_id")
        if not sid:
            continue
        s = api("GET", f"/sessions/{sid}")
        etat = s.get("status")
        print("session", sid, "état :", etat)
        if etat in ("idle", "terminated", "completed", "failed", "ended", "archived"):
            ev = api("GET", f"/sessions/{sid}/events?limit=200").get("data", [])
            textes = [b.get("text", "") for e in ev if e.get("type", "").startswith("agent") for b in (e.get("content") or []) if isinstance(b, dict) and b.get("type") == "text"]
            print("--- dernier message de l'agent ---")
            print((textes[-1] if textes else "(aucun texte)")[:3000])
            ids[f"dernier_test_{test}"] = sid; sauver()
            break
print("terminé. Identifiants :", IDS_F)
