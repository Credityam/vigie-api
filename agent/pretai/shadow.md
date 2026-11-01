TÂCHE : SUIVI SHADOW — paiements des 9 dossiers (hebdomadaire, pour JF seulement).

Fin août 2026, 9 enquêtes de crédit « shadow » ont été faites (verdicts figés). On suit leurs résultats RÉELS. Prêts à vérifier (Name | verdict shadow) :
- PR-00018217 | REFUSE (stacking)
- PR-00018216 | MANUEL/pondération — accordé 1000 $
- PR-00018215 | MANUEL/pondération — accordé 1000 $
- PR-00018214 | REFUSE (avocat)
- PR-00018212 | REFUSE (propo active)
- PR-00018247 | REFUSE (ERS 431)
- PR-00018248 | demande du 28 août (client F. S.), décision maison inconnue au départ — prêt trouvé le 1er nov.
- Clients D. C. et M. L. : shadow REFUSE, aucun prêt au 28 août → vérifie s'ils en ont un maintenant : SELECT Name, Status__c, CreatedDate FROM loan__c WHERE Contact__r.Name IN ('Dylan Croteau','Miguel Laporte') (ne recopie jamais ces noms dans le courriel : initiales seulement).

Requête : SELECT Name, Status__c, Etat_Du_Compte__c, Paiments_encaisses__c, No_Paiements_Paye__c, Nombre_de_NSF__c, Total_NSF__c, Total_Encaisse_Cash__c, Total_Debourse_Cash__c, Net_Cash__c, Dernier_Paiement_Effectue__c, Date_dernier_pmt_effectu__c, Solde_actuel__c, CreatedDate FROM loan__c WHERE Name IN (...). Pour voir ce qui a changé depuis la semaine passée : SELECT Parent.Name, Field, OldValue, NewValue, CreatedDate FROM loan__History WHERE Parent.Name IN (...) AND CreatedDate = LAST_N_DAYS:8.

COURRIEL à JF (a = ["jfchaput@credityamaska.com"], sujet « Shadow — suivi des 9 dossiers <date> », niveau "bilan") : une ligne par dossier (Name, verdict shadow, paie / ne paie pas : paiements encaissés, NSF, dernier paiement, net cash, statut et sous-statut ; changement depuis 7 jours en gras). Souligne les divergences instructives : un refus shadow qui paie parfaitement, ou un accordé qui tombe en recouvrement. Termine par une ligne de bilan (n paient / n en trouble / n inchangés). Court. Si rien n'a bougé depuis 7 jours sur aucun dossier, envoie quand même 3 lignes (« rien de neuf ») — c'est hebdomadaire. Signe « Claude (assistant PretAI) ».
