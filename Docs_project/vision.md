# Projet Chatbot IAE
- Créer un chatbot utilisant les APIs de Mistral AI 

##  Architecture Multi-Agents
J'ai créé trois agents spécialisés :

- Document Library Agent : Recherche dans la base de connaissance (ID: 0685d8e8-a642-728f-8000-36cc6feba626 )
--> Documentation : https://docs.mistral.ai/agents/connectors/document_library/
- Websearch Agent : Recherche sur le site IAE Lyon 3 via web_search --> documentation : https://docs.mistral.ai/agents/connectors/websearch/
- Document Q&A Agent : Analyse approfondie des documents PDF trouvés
--> documentation : https://docs.mistral.ai/capabilities/OCR/document_qna/ 
## :arrows_counterclockwise: Workflow Intelligent
Le système suit une logique de handoffs optimisée :

1. Étape 1 : Recherche dans la base de connaissance
2. Étape 2 : Si aucune info trouvée → Recherche web sur site:iae.univ-lyon3.fr
3. Étape 3 : Si des PDFs sont détectés → Analyse approfondie avec Document Q&A
## :bar_chart: Feedback Utilisateur en Temps Réel
- Indicateurs visuels : Statut des étapes (en attente, actif, terminé) avec animations
- Workflow path : Affichage du chemin d'exécution dans chaque réponse
- Logs détaillés : Section mise à jour pour montrer le workflow agentic complet
## :dart: Fonctionnalités Implémentées
- Détection automatique des URLs PDF pour déclencher l'agent Document Q&A
- Gestion d'erreurs robuste avec reset automatique du workflow
- Interface utilisateur enrichie avec indicateurs de progression
- Logs API mis à jour pour refléter le workflow multi-ag