/**
 * @file Agent configurations for IAE Chatbot Mistral
 * 
 * This file contains the centralized configuration for all Mistral AI agents
 * used in the application. These configurations are used by the AgentService
 * to create and manage agents consistently.
 */

import { AgentConfig } from '@types/index';

/**
 * Document Library Agent Configuration
 * 
 * This agent is responsible for searching the IAE Lyon 3 knowledge base.
 * It uses the document_library tool to find relevant information.
 */
export const documentLibraryAgentConfig: AgentConfig = {
  model: "mistral-medium-latest",
  name: "IAE-Docs",
  description: "Recherche dans la base de connaissance IAE",
  instructions: `Tu es un agent spécialisé pour rechercher dans la base de connaissance de l'IAE Lyon 3.

Instructions :
1. Utilise TOUJOURS l'outil document_library pour rechercher des informations
2. Réponds en français de manière professionnelle
3. Si tu trouves des informations pertinentes, fournis une réponse complète
4. Si tu ne trouves AUCUNE information pertinente, réponds exactement : "AUCUNE_INFO_TROUVEE"
5. Spécialise-toi dans : formations, admissions, vie étudiante, recherche, international, stages, carrières`,
  tools: [
    {
      type: "document_library",
      document_library: {
        library_ids: ["0685d6e8-a642-728f-8000-36cc6feba626"]
      }
    }
  ],
  temperature: 0.3,
  top_p: 0.95,
  handoffs: [] // Will be populated at runtime with websearchAgentConfig.id
};

/**
 * Websearch Agent Configuration
 * 
 * This agent is responsible for searching the IAE Lyon 3 website.
 * It uses the web_search tool with site-specific filtering.
 */
export const websearchAgentConfig: AgentConfig = {
  model: "mistral-medium-latest",
  name: "IAE-Websearch",
  description: "Agent spécialisé pour rechercher sur le site iae.univ-lyon3.fr",
  instructions: `Tu es un agent spécialisé pour rechercher sur le site de l'IAE Lyon 3.

Instructions strictes :
1. Utilise TOUJOURS web_search avec "site:iae.univ-lyon3.fr" suivi des mots-clés
2. Recherche UNIQUEMENT sur le domaine iae.univ-lyon3.fr
3. Réponds en français de manière professionnelle
4. Si tu trouves des URLs de PDF, mentionne-les clairement dans ta réponse
5. Cite TOUJOURS tes sources avec les URLs complètes
6. Si aucun résultat pertinent, réponds : "AUCUN_RESULTAT_WEB"`,
  tools: [
    {
      type: "web_search"
    }
  ],
  temperature: 0.3,
  top_p: 0.95,
  handoffs: [] // Will be populated at runtime with docQAAgentConfig.id
};

/**
 * Document Q&A Agent Configuration
 * 
 * This agent is responsible for analyzing PDF documents from the IAE Lyon 3.
 * It uses the document_qna tool for OCR and document analysis.
 */
export const docQAAgentConfig: AgentConfig = {
  model: "mistral-medium-latest",
  name: "IAE-DocQnA",
  description: "Agent spécialisé pour analyser les documents PDF de l'IAE Lyon 3",
  instructions: `Tu es un agent spécialisé pour analyser les documents PDF de l'IAE Lyon 3.

Instructions :
1. Utilise l'outil document_qna pour analyser le contenu des PDFs
2. Fournis des réponses détaillées basées sur le contenu des documents
3. Réponds en français de manière professionnelle
4. Cite les sections pertinentes des documents
5. Si le document ne contient pas l'information demandée, indique-le clairement`,
  tools: [
    {
      type: "document_qna"
    }
  ],
  temperature: 0.3,
  top_p: 0.95,
  handoffs: [] // No further handoffs
};

/**
 * Agent configurations indexed by type
 */
export const agentConfigs = {
  documentLibrary: documentLibraryAgentConfig,
  websearch: websearchAgentConfig,
  docQA: docQAAgentConfig
};

/**
 * Library ID for IAE Lyon 3 knowledge base
 */
export const IAE_LIBRARY_ID = "0685d6e8-a642-728f-8000-36cc6feba626";

/**
 * Configure handoffs between agents
 * 
 * This function sets up the handoff chain between agents:
 * Document Library -> Websearch -> Document Q&A
 * 
 * @param agentIds - Map of agent types to their IDs
 * @returns Updated agent configurations with handoffs
 */
export function configureHandoffs(agentIds: Record<string, string>): typeof agentConfigs {
  const configs = { ...agentConfigs };
  
  // Document Library -> Websearch
  if (agentIds.websearch) {
    configs.documentLibrary = {
      ...configs.documentLibrary,
      handoffs: [agentIds.websearch]
    };
  }
  
  // Websearch -> Document Q&A
  if (agentIds.docQA) {
    configs.websearch = {
      ...configs.websearch,
      handoffs: [agentIds.docQA]
    };
  }
  
  return configs;
}

export default agentConfigs;
