Run LEADSOURCE (lundi 7 h 43, hebdomadaire) : l'attribution des leads (Lead Source et campagne) reste-t-elle fiable ? J-F prend ses décisions de budget pub sur ces chiffres. Applique tes instructions générales (outils, investigation, contenu des rapports), avec ces précisions propres à ce run :
- Rapport : nom « AAAA-MM-JJ_leadsource.md ». Pas de bilan hebdo à part : ce run EST hebdomadaire.
- Routage : tout ROUGE de ce run → jfchaput@credityamaska.com SEULEMENT. Sujet : « 🔴 Vigie LeadSource — <date> — <résumé court> ».
- Les JAUNES restent dans le rapport (aucun courriel).

CONTEXTE (mis à jour le 11 nov. 2026, projet LeadSource terminé) :
- Formulaires d'Yves (credityamaska.com/Demande/demande.php, v2 depuis le 10 nov., et margex.ca/Demande/demande.php) : la source vient de l'URL (lsrc, cpid), sinon d'un cookie, sinon d'une valeur par défaut.
- Défaut sur credityamaska.com depuis le 10 nov. : Lead Source « Direct - Organique » + campagne « Naturel 2026 CY » (701JR000013T1o7YAC). Avant, c'était « Site Credit Yamaska » sans campagne. Ce sont de vrais visiteurs directs ou organiques : Analytics montre environ 26 % de trafic non payé, donc 20 à 30 % de « Direct - Organique » est NORMAL, pas un problème.
- Défaut sur margex.ca : Lead Source « Margex » + campagne « Naturel 2026 margex » (701JR000013FUTQYA4).
- La marque vient du record type du Lead : « Nouvelle demande » = Crédit Yamaska, « Marge » = Margex. Luc crée des valeurs de Lead Source par campagne (ex. « Margex Tik Tok », « Margex Mailchimp », « Brand », « Google loan ») : c'est voulu, ne le signale pas.
- Google argent a sa propre campagne depuis le 10 nov. (701JR00000rth2bYAA) ; Google Brand garde 701JR00000rtghdYAA.
- Perte connue et acceptée par J-F : un client qui passe par le chat Agentforce avant le formulaire arrive sans source (environ 1 lead par jour). Ne le signale pas.
- Budgets Google Ads réduits par Luc entre le 5 et le 8 nov. (environ 370 $/jour au lieu de 1 120 $) : une baisse des sources Google en novembre a une cause connue.

L1 Sources de la semaine dernière, Crédit Yamaska (lundi à dimanche, plages de dates explicites) :
  SELECT LeadSource, Campaign_ID__c, COUNT(Id) c FROM Lead WHERE CreatedDate >= <lundi>T00:00:00-05:00 AND CreatedDate < <lundi suivant>T00:00:00-05:00 AND RecordType.Name = 'Nouvelle demande' GROUP BY LeadSource, Campaign_ID__c
  Donne la part de chaque famille (Google, Mailchimp, TikTok, Direct - Organique, autres) et la tendance sur 4 semaines (avant le 10 nov., « Site Credit Yamaska » tenait la place de « Direct - Organique »).
  Régression = leads « Site Credit Yamaska », « credityamaska.com », « Other » ou vide après le 10 nov. (le défaut du formulaire a sauté) : donne leur nombre et leur part.
L2 Volume : total « Nouvelle demande » + « Marge » de la semaine dernière vs moyenne des 4 précédentes. Si baisse de plus de 40 % : regarde si elle touche surtout les sources payées (budget ou pub coupée) ou aussi « Direct - Organique » (signe d'un formulaire brisé).
L3 Margex (record type Marge) : leads par Lead Source et campagne (TikTok 701JR000013F5q6YAC, Mailchimp 701JR000013Q1cdYAC, Naturel 701JR000013FUTQYA4).
L4 Campagnes : leads payés sans Campaign_ID__c (Lead Source Google, TikTok, Mailchimp… mais cpid vide), et leads Google argent sous 701JR00000rtghdYAA (régression).
L5 Chat Agentforce (informatif) : SELECT COUNT(Id) FROM MessagingSession WHERE CreatedDate = LAST_WEEK AND MessagingChannel.MessageType = 'EmbeddedMessaging'.

NIVEAUX :
- ROUGE : volume en baisse de plus de 40 % ET « Direct - Organique » aussi en chute (le formulaire lui-même est probablement brisé), ou plus de 10 % des leads CY en « Site Credit Yamaska » / « Other » / vide (le défaut du formulaire a sauté).
- JAUNE : baisse de plus de 40 % limitée aux sources payées (budget ou pub coupée, à confirmer avec Luc), Google argent de nouveau sous la campagne de Brand, plus de 5 % de leads payés sans campagne, ou 3 à 10 % de leads CY sans source.
- VERT : sinon.

RAPPORT : moins de 300 mots. Première ligne « 🔴/🟡/🟢 Vigie LeadSource — semaine du <date> » ; puis répartition par source (semaine et tendance), volume, Margex, campagnes, sessions de chat, une phrase de recommandation. Pas de nom de client.
