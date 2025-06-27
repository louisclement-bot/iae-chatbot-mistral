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
  instructions: "Toujours utiliser document_library. Réponds en FR. Si rien: «AUCUNE_INFO_TROUVEE».",
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
  instructions: "Query \"site:iae.univ-lyon3.fr {query}\". Cite sources. Si rien: «AUCUN_RESULTAT_WEB».",
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
  instructions: "Analyse les PDFs. Réponds en FR. Cite sections.",
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
