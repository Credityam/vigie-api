Run LEADSOURCE (lundi 7 h 43, hebdomadaire) : l'attribution des leads (Lead Source) est-elle fiable ? J-F prend ses décisions de budget pub sur ces chiffres. Applique tes instructions générales (outils, investigation, contenu des rapports), avec ces précisions propres à ce run :
- Rapport : nom « AAAA-MM-JJ_leadsource.md ». Pas de bilan hebdo à part : ce run EST hebdomadaire.
- Routage : tout ROUGE de ce run → jfchaput@credityamaska.com SEULEMENT. Sujet : « 🔴 Vigie LeadSource — <date> — <résumé court> ».
- Les JAUNES restent dans le rapport (aucun courriel), SAUF l'exception « fiable » plus bas.

CONTEXTE (3 nov. 2026) : 24 % des leads arrivaient avec LeadSource « Site Credit Yamaska » sans vraie source. Cause : les formulaires PHP d'Yves (credityamaska.com/Demande/demande.php et margex.ca/Demande/demande.php) mettent cette valeur par défaut quand l'URL n'a pas le paramètre lsrc. Correctif décidé le 3 nov. : script JS de Luc dans l'en-tête des 2 sites (cookies ck_lsrc et ck_cpid), code d'Yves qui relit ces cookies (lsrc + cpid en groupe), défaut « Margex » sur margex.ca. Date de mise en ligne inconnue : déduis-la des données (chute nette de la part « Site Credit Yamaska ») et dis-la. Autre problème : Google argent et Google Brand partagent la même campagne (Campaign_ID__c 701JR00000rtghdYAA « Google Brand 2026 ») ; correctif chez Luc.

L1 Part sans source, 5 dernières semaines complètes (lundi à dimanche, plages de dates explicites, RecordType.Name = 'Nouvelle demande') :
  SELECT LeadSource, COUNT(Id) c FROM Lead WHERE CreatedDate >= <lundi>T00:00:00-05:00 AND CreatedDate < <lundi suivant>T00:00:00-05:00 AND RecordType.Name = 'Nouvelle demande' GROUP BY LeadSource
  Part sans source = (Site Credit Yamaska + Other + vide) / total. Donne la semaine dernière et la tendance des 4 précédentes.
L2 Volume : total de la semaine dernière vs moyenne des 4 précédentes. ROUGE si baisse de plus de 40 % (un formulaire est peut-être brisé par le correctif) : vérifie avant d'alerter si c'est un férié ou une coupure de pub (baisse égale dans toutes les sources).
L3 Margex : leads LeadSource = 'Margex' par semaine (doit monter après le correctif).
L4 Google argent vs Brand : SELECT LeadSource, Campaign_ID__c, COUNT(Id) c FROM Lead WHERE CreatedDate = LAST_WEEK AND LeadSource LIKE 'Google%' GROUP BY LeadSource, Campaign_ID__c. Réglé quand Google argent a un Campaign_ID__c différent de 701JR00000rtghdYAA.
L5 Chat Agentforce (informatif) : SELECT COUNT(Id) FROM MessagingSession WHERE CreatedDate = LAST_WEEK AND MessagingChannel.MessageType = 'EmbeddedMessaging'.

NIVEAUX :
- ROUGE : L2 (baisse de volume inexpliquée de plus de 40 %), ou part sans source qui REMONTE de plus de 10 points d'une semaine à l'autre après avoir baissé.
- JAUNE : part sans source au-dessus de 5 % alors que le correctif semble en ligne, ou argent et Brand encore confondus. Avant la mise en ligne, la part élevée est attendue : JAUNE « correctif pas encore en ligne ».
- VERT : part sans source sous 5 % et argent/Brand séparés.
EXCEPTION « fiable » : la PREMIÈRE semaine où la part sans source passe sous 5 % (vérifie les rapports _leadsource précédents), envoie un court courriel à jfchaput@credityamaska.com, niveau « jaune », sujet « ✅ LeadSource fiable depuis la semaine du <date> », avec les chiffres.

RAPPORT : moins de 300 mots. Première ligne « 🔴/🟡/🟢 Vigie LeadSource — semaine du <date> » ; puis part sans source (semaine et tendance), volume, Margex, argent/Brand, sessions de chat, date probable de mise en ligne du correctif, une phrase de recommandation. Pas de nom de client (il n'y en a pas besoin ici).
