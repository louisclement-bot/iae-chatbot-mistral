/**
 * @file Agent Service for Mistral AI
 * 
 * Provides methods for creating, updating, listing, and managing Mistral AI agents.
 * This service abstracts the complexity of the Mistral AI API and provides
 * a clean interface for interacting with agents.
 */

import fetchWithRetry from '@utils/fetchWithRetry';
import { Agent, AgentConfig, Result, FetchWithRetryOptions } from '@types/index';

/**
 * Options for creating an agent
 */
export interface CreateAgentOptions {
  /** Override the default API base URL */
  apiBaseUrl?: string;
  /** Override the default retry options */
  fetchOptions?: FetchWithRetryOptions;
}

/**
 * Options for updating an agent
 */
export interface UpdateAgentOptions extends CreateAgentOptions {
  /** Whether to replace the entire agent or just update specific fields */
  replace?: boolean;
}

/**
 * Options for listing agents
 */
export interface ListAgentsOptions extends CreateAgentOptions {
  /** Maximum number of agents to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Filter agents by name */
  name?: string;
}

/**
 * Service for managing Mistral AI agents
 */
export class AgentService {
  private readonly apiBaseUrl: string;
  private readonly apiKey: string;

  /**
   * Create a new AgentService
   * 
   * @param apiKey - Mistral AI API key
   * @param apiBaseUrl - Base URL for the Mistral AI API
   */
  constructor(apiKey: string, apiBaseUrl: string = 'https://api.mistral.ai/v1') {
    this.apiKey = apiKey;
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Get standard headers for API requests
   * 
   * @returns Headers object with Authorization and Content-Type
   */
  private getHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'iae-chatbot/1.0 (+https://iae.univ-lyon3.fr)'
    };
  }

  /**
   * Format agent configuration for API request
   * 
   * @param config - Agent configuration
   * @returns Formatted agent configuration for API request
   */
  private formatAgentConfig(config: AgentConfig): Record<string, any> {
    return {
      model: config.model,
      name: config.name,
      description: config.description,
      instructions: config.instructions,
      tools: config.tools,
      handoffs: config.handoffs || [],
      completion_args: {
        temperature: config.temperature || 0.3,
        top_p: config.top_p || 0.95
      }
    };
  }

  /**
   * Create a new agent
   * 
   * @param config - Agent configuration
   * @param options - Options for creating the agent
   * @returns Result containing the created agent or an error
   */
  async createAgent(
    config: AgentConfig,
    options?: CreateAgentOptions
  ): Promise<Result<Agent, Error>> {
    const url = `${options?.apiBaseUrl || this.apiBaseUrl}/agents`;
    const formattedConfig = this.formatAgentConfig(config);

    return await fetchWithRetry<Agent>(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(formattedConfig),
      ...options?.fetchOptions
    });
  }

  /**
   * Update an existing agent
   * 
   * @param agentId - ID of the agent to update
   * @param config - New agent configuration
   * @param options - Options for updating the agent
   * @returns Result containing the updated agent or an error
   */
  async updateAgent(
    agentId: string,
    config: Partial<AgentConfig>,
    options?: UpdateAgentOptions
  ): Promise<Result<Agent, Error>> {
    const url = `${options?.apiBaseUrl || this.apiBaseUrl}/agents/${agentId}`;
    
    // If replace is true, format the entire config
    // Otherwise, just send the fields that are provided
    const body = options?.replace 
      ? this.formatAgentConfig(config as AgentConfig)
      : config;

    return await fetchWithRetry<Agent>(url, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      ...options?.fetchOptions
    });
  }

  /**
   * Get an agent by ID
   * 
   * @param agentId - ID of the agent to get
   * @param options - Options for getting the agent
   * @returns Result containing the agent or an error
   */
  async getAgent(
    agentId: string,
    options?: CreateAgentOptions
  ): Promise<Result<Agent, Error>> {
    const url = `${options?.apiBaseUrl || this.apiBaseUrl}/agents/${agentId}`;

    return await fetchWithRetry<Agent>(url, {
      method: 'GET',
      headers: this.getHeaders(),
      ...options?.fetchOptions
    });
  }

  /**
   * List all agents
   * 
   * @param options - Options for listing agents
   * @returns Result containing an array of agents or an error
   */
  async listAgents(
    options?: ListAgentsOptions
  ): Promise<Result<Agent[], Error>> {
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (options?.limit) queryParams.append('limit', options.limit.toString());
    if (options?.offset) queryParams.append('offset', options.offset.toString());
    if (options?.name) queryParams.append('name', options.name);
    
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const url = `${options?.apiBaseUrl || this.apiBaseUrl}/agents${queryString}`;

    return await fetchWithRetry<Agent[]>(url, {
      method: 'GET',
      headers: this.getHeaders(),
      ...options?.fetchOptions
    });
  }

  /**
   * Delete an agent
   * 
   * @param agentId - ID of the agent to delete
   * @param options - Options for deleting the agent
   * @returns Result indicating success or an error
   */
  async deleteAgent(
    agentId: string,
    options?: CreateAgentOptions
  ): Promise<Result<void, Error>> {
    const url = `${options?.apiBaseUrl || this.apiBaseUrl}/agents/${agentId}`;

    return await fetchWithRetry<void>(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
      ...options?.fetchOptions
    });
  }

  /**
   * Configure handoffs between agents
   * 
   * @param sourceAgentId - ID of the source agent
   * @param targetAgentIds - IDs of the target agents
   * @param options - Options for configuring handoffs
   * @returns Result containing the updated agent or an error
   */
  async configureHandoffs(
    sourceAgentId: string,
    targetAgentIds: string[],
    options?: UpdateAgentOptions
  ): Promise<Result<Agent, Error>> {
    const url = `${options?.apiBaseUrl || this.apiBaseUrl}/agents/${sourceAgentId}`;

    return await fetchWithRetry<Agent>(url, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ handoffs: targetAgentIds }),
      ...options?.fetchOptions
    });
  }

  /**
   * Check if an agent exists
   * 
   * @param agentId - ID of the agent to check
   * @param options - Options for checking the agent
   * @returns Result containing a boolean indicating if the agent exists
   */
  async agentExists(
    agentId: string,
    options?: CreateAgentOptions
  ): Promise<Result<boolean, Error>> {
    const result = await this.getAgent(agentId, options);
    
    if (result.success) {
      return { success: true, data: true };
    } else {
      // If it's a 404 error, the agent doesn't exist
      if (result.error.message.includes('404')) {
        return { success: true, data: false };
      }
      // For other errors, propagate the error
      return { success: false, error: result.error };
    }
  }

  /**
   * Create all required agents for the IAE chatbot
   * 
   * @param configs - Map of agent type to configuration
   * @param options - Options for creating the agents
   * @returns Result containing a map of agent type to agent
   */
  async createAllAgents(
    configs: Record<string, AgentConfig>,
    options?: CreateAgentOptions
  ): Promise<Result<Record<string, Agent>, Error>> {
    try {
      // Create all agents in parallel
      const agentPromises = Object.entries(configs).map(async ([type, config]) => {
        const result = await this.createAgent(config, options);
        if (!result.success) {
          throw new Error(`Failed to create agent ${type}: ${result.error.message}`);
        }
        return [type, result.data];
      });

      // Wait for all agents to be created
      const agentEntries = await Promise.all(agentPromises);
      
      // Convert entries to record
      const agents = Object.fromEntries(agentEntries) as Record<string, Agent>;
      
      return { success: true, data: agents };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Test API connectivity
   * 
   * @param options - Options for testing connectivity
   * @returns Result indicating success or an error
   */
  async testConnectivity(
    options?: CreateAgentOptions
  ): Promise<Result<boolean, Error>> {
    const url = `${options?.apiBaseUrl || this.apiBaseUrl}/models`;

    const result = await fetchWithRetry<any>(url, {
      method: 'GET',
      headers: this.getHeaders(),
      ...options?.fetchOptions
    });

    if (result.success) {
      return { success: true, data: true };
    } else {
      return { success: false, error: result.error };
    }
  }
}

/**
 * Create a singleton instance of the AgentService
 * 
 * @param apiKey - Mistral AI API key
 * @param apiBaseUrl - Base URL for the Mistral AI API
 * @returns AgentService instance
 */
export const createAgentService = (
  apiKey: string,
  apiBaseUrl?: string
): AgentService => {
  return new AgentService(apiKey, apiBaseUrl);
};

export default AgentService;
