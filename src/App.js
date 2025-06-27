import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, ExternalLink, Search, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const App = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: "Bonjour ! Je suis l'assistant intelligent de l'IAE Lyon 3. Je peux vous aider à trouver des informations sur nos formations, admissions, vie étudiante et plus encore. Comment puis-je vous assister aujourd'hui ?",
      timestamp: new Date(),
      sources: []
    }
  ]);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentId, setAgentId] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [agents, setAgents] = useState({
    documentLibrary: null,
    websearch: null,
    docQA: null
  });
  const [workflowSteps, setWorkflowSteps] = useState([
    { id: 1, name: 'Document Library', icon: '📚', status: 'pending', agent: 'documentLibrary' },
    { id: 2, name: 'Websearch IAE', icon: '🔍', status: 'pending', agent: 'websearch' },
    { id: 3, name: 'Document Q&A', icon: '📄', status: 'pending', agent: 'docQA' }
  ]);
  const messagesEndRef = useRef(null);

  const MISTRAL_API_KEY = process.env.REACT_APP_MISTRAL_API_KEY;
  const MISTRAL_API_BASE = 'https://api.mistral.ai/v1';

  // All the functions and logic from IAEChatbot component
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const createMistralAgents = useCallback(async () => {
    try {
      console.log('Création des agents Mistral...');
      
      // Vérifier que la clé API est configurée
      if (!MISTRAL_API_KEY) {
        console.error('ERREUR: Clé API Mistral non configurée. Veuillez créer un fichier .env avec REACT_APP_MISTRAL_API_KEY');
        throw new Error('Clé API Mistral non configurée');
      }
      
      console.log('Clé API détectée:', MISTRAL_API_KEY.substring(0, 10) + '...');
      console.log('URL de base API:', MISTRAL_API_BASE);
      
      // Agent 1: Document Library (recherche dans la base de connaissance)
      const docLibConfig = {
        model: "mistral-medium-latest",
        description: "Agent spécialisé pour rechercher dans la base de connaissance de l'IAE Lyon 3",
        name: "IAE Document Library Agent",
        instructions: `Tu es un agent spécialisé pour rechercher dans la base de connaissance de l'IAE Lyon 3.

Instructions :
1. Utilise TOUJOURS l'outil document_library pour rechercher des informations
2. Réponds en français de manière professionnelle
3. Si tu trouves des informations pertinentes, fournis une réponse complète
4. Si tu ne trouves AUCUNE information pertinente, réponds exactement : "AUCUNE_INFO_TROUVEE"
5. Spécialise-toi dans : formations, admissions, vie étudiante, recherche, international, stages, carrières`,
        tools: [
          {
            "type": "document_library",
            "document_library": {
              "library_ids": ["0685d6e8-a642-728f-8000-36cc6feba626"]
            }
          }
        ],
        temperature: 0.3,
        top_p: 0.95
      };

      // Agent 2: Websearch (recherche sur le site IAE)
      const websearchConfig = {
        model: "mistral-medium-latest",
        description: "Agent spécialisé pour rechercher sur le site iae.univ-lyon3.fr",
        name: "IAE Websearch Agent",
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
            "type": "web_search"
          }
        ],
        temperature: 0.3,
        top_p: 0.95
      };

      // Agent 3: Document Q&A (analyse des PDFs)
      const docQAConfig = {
        model: "mistral-medium-latest",
        description: "Agent spécialisé pour analyser les documents PDF de l'IAE Lyon 3",
        name: "IAE Document Q&A Agent",
        instructions: `Tu es un agent spécialisé pour analyser les documents PDF de l'IAE Lyon 3.

Instructions :
1. Utilise l'outil document_library pour analyser le contenu des PDFs
2. Fournis des réponses détaillées basées sur le contenu des documents
3. Réponds en français de manière professionnelle
4. Cite les sections pertinentes des documents
5. Si le document ne contient pas l'information demandée, indique-le clairement`,
        tools: [
          {
            "type": "document_library",
            "document_library": {
              "library_ids": ["0685d6e8-a642-728f-8000-36cc6feba626"]
            }
          }
        ],
        temperature: 0.3,
        top_p: 0.95
      };

      // Test de connectivité API d'abord
      const debugMsg = 'Test de connectivité avec l\'API Mistral...';
      console.log(debugMsg);
      setDebugInfo(debugMsg);
      
      console.log('API Key présente:', !!MISTRAL_API_KEY);
      console.log('API Base URL:', MISTRAL_API_BASE);
      setDebugInfo(prev => prev + `\nAPI Key présente: ${!!MISTRAL_API_KEY}\nAPI Base URL: ${MISTRAL_API_BASE}`);
      
      const testResponse = await fetch(`${MISTRAL_API_BASE}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${MISTRAL_API_KEY}`,
          'Accept': 'application/json'
        }
      });
      
      console.log('Test API Response Status:', testResponse.status);
      setDebugInfo(prev => prev + `\nTest API Response Status: ${testResponse.status}`);
      
      if (!testResponse.ok) {
        const testError = await testResponse.text();
        console.error('Erreur de connectivité API (Status:', testResponse.status, '):', testError);
        setDebugInfo(prev => prev + `\nErreur API: ${testError}`);
        throw new Error('Impossible de se connecter à l\'API Mistral');
      }
      
      const modelsData = await testResponse.json();
      console.log('Modèles disponibles:', modelsData.data?.length || 0);
      setDebugInfo(prev => prev + `\nModèles disponibles: ${modelsData.data?.length || 0}\nConnectivité API OK, création des agents...`);
      console.log('Connectivité API OK, création des agents...');
      
      // Créer les trois agents avec la nouvelle API
      const [docLibAgent, websearchAgent, docQAAgent] = await Promise.all([
        fetch(`${MISTRAL_API_BASE}/agents`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${MISTRAL_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            model: docLibConfig.model,
            name: docLibConfig.name,
            description: docLibConfig.description,
            instructions: docLibConfig.instructions,
            tools: docLibConfig.tools,
            completion_args: {
              temperature: docLibConfig.temperature,
              top_p: docLibConfig.top_p
            }
          })
        }),
        fetch(`${MISTRAL_API_BASE}/agents`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${MISTRAL_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            model: websearchConfig.model,
            name: websearchConfig.name,
            description: websearchConfig.description,
            instructions: websearchConfig.instructions,
            tools: websearchConfig.tools,
            completion_args: {
              temperature: websearchConfig.temperature,
              top_p: websearchConfig.top_p
            }
          })
        }),
        fetch(`${MISTRAL_API_BASE}/agents`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${MISTRAL_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            model: docQAConfig.model,
            name: docQAConfig.name,
            description: docQAConfig.description,
            instructions: docQAConfig.instructions,
            tools: docQAConfig.tools,
            completion_args: {
              temperature: docQAConfig.temperature,
              top_p: docQAConfig.top_p
            }
          })
        })
      ]);

      if (!docLibAgent.ok || !websearchAgent.ok || !docQAAgent.ok) {
        console.error('Erreurs de création des agents:');
        if (!docLibAgent.ok) {
          const docLibError = await docLibAgent.text();
          console.error('Document Library Agent Error (Status:', docLibAgent.status, '):', docLibError);
        }
        if (!websearchAgent.ok) {
          const websearchError = await websearchAgent.text();
          console.error('Websearch Agent Error (Status:', websearchAgent.status, '):', websearchError);
        }
        if (!docQAAgent.ok) {
          const docQAError = await docQAAgent.text();
          console.error('Document Q&A Agent Error (Status:', docQAAgent.status, '):', docQAError);
        }
        throw new Error('Erreur lors de la création des agents - Vérifiez la console pour plus de détails');
      }

      const [docLibData, websearchData, docQAData] = await Promise.all([
        docLibAgent.json(),
        websearchAgent.json(),
        docQAAgent.json()
      ]);

      const agentsData = {
        documentLibrary: docLibData,
        websearch: websearchData,
        docQA: docQAData
      };

      setAgents(agentsData);
      setAgentId(docLibData.id); // Agent par défaut
      console.log('Agents créés avec succès:', agentsData);
      return agentsData;
    } catch (error) {
      console.error('Erreur lors de la création des agents:', error);
      throw error;
    }
  }, []);

  useEffect(() => {
    if (!agents.documentLibrary) {
      createMistralAgents().catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents.documentLibrary]);

  const updateWorkflowStep = (stepId, status) => {
    setWorkflowSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const callAgentAPI = async (agentId, userMessage, stepName) => {
    try {
      const conversationPayload = {
        agent_id: agentId,
        messages: [
          {
            role: "user",
            content: userMessage
          }
        ]
      };

      console.log(`Appel ${stepName}:`, conversationPayload);

      const response = await fetch(`${MISTRAL_API_BASE}/agents/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MISTRAL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(conversationPayload)
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`Erreur ${stepName}:`, errorData);
        throw new Error(`Erreur API Mistral ${stepName}: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Réponse ${stepName}:`, data);
      
      if (data.id) {
        setConversationId(data.id);
      }

      const message = data.choices && data.choices[0] && data.choices[0].message;
      
      if (!message) {
        throw new Error(`Réponse invalide de ${stepName}`);
      }

      let content = message.content || '';
      const sources = [];
      let hasPdfUrls = false;

      // Détecter les URLs de PDF dans le contenu
      if (content.includes('.pdf')) {
        hasPdfUrls = true;
      }

      // Traiter les tool_calls s'ils existent
      if (message.tool_calls) {
        message.tool_calls.forEach(toolCall => {
          if (toolCall.function) {
            sources.push({
              title: toolCall.function.name,
              url: toolCall.function.arguments || '',
              source: toolCall.type
            });
          }
        });
      }

      return {
        content: content.trim(),
        sources: sources,
        rawApiResponse: data,
        hasPdfUrls: hasPdfUrls,
        stepName: stepName
      };

    } catch (error) {
      console.error(`Erreur lors de l'appel ${stepName}:`, error);
      console.error(`Détails de l'erreur ${stepName}:`, {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      throw error;
    }
  };

  const executeWorkflow = async (userMessage) => {
    try {
      console.log('État des agents:', {
        documentLibrary: !!agents.documentLibrary,
        websearch: !!agents.websearch,
        docQA: !!agents.docQA,
        agents: agents
      });
      
      if (!agents.documentLibrary || !agents.websearch || !agents.docQA) {
        console.error('Agents manquants:', {
          documentLibrary: agents.documentLibrary,
          websearch: agents.websearch,
          docQA: agents.docQA
        });
        throw new Error('Agents non initialisés');
      }

      // Réinitialiser le workflow
       setWorkflowSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));

      // Étape 1: Document Library
      updateWorkflowStep(1, 'active');
      const docLibResult = await callAgentAPI(
        agents.documentLibrary.id, 
        userMessage, 
        'Document Library'
      );
      
      updateWorkflowStep(1, 'completed');

      // Vérifier si Document Library a trouvé des informations
       if (!docLibResult.content.includes('AUCUNE_INFO_TROUVEE')) {
         // Informations trouvées dans la base de connaissance
         return {
           ...docLibResult,
           workflowPath: ['Document Library']
         };
       }

      // Étape 2: Websearch
       updateWorkflowStep(2, 'active');
      
      const searchQuery = `site:iae.univ-lyon3.fr ${userMessage}`;
      const websearchResult = await callAgentAPI(
        agents.websearch.id, 
        `Recherche des informations sur "${userMessage}" en utilisant web_search avec la requête: "${searchQuery}"`, 
        'Websearch'
      );
      
      updateWorkflowStep(2, 'completed');

      // Vérifier si Websearch a trouvé des résultats
       if (websearchResult.content.includes('AUCUN_RESULTAT_WEB')) {
         // Aucun résultat trouvé
         return {
           content: "Désolé, je n'ai trouvé aucune information pertinente dans la base de connaissance de l'IAE ni sur le site officiel. Pourriez-vous reformuler votre question ou être plus précis ?",
           sources: [],
           rawApiResponse: websearchResult.rawApiResponse,
           workflowPath: ['Document Library', 'Websearch'],
           stepName: 'Workflow complet'
         };
       }

      // Vérifier si des PDFs ont été trouvés
       if (websearchResult.hasPdfUrls) {
         // Étape 3: Document Q&A pour analyser les PDFs
         updateWorkflowStep(3, 'active');
         
         const docQAResult = await callAgentAPI(
           agents.docQA.id, 
           `Analyse les documents PDF mentionnés pour répondre à la question: "${userMessage}". Contexte des PDFs trouvés: ${websearchResult.content}`, 
           'Document Q&A'
         );
         
         updateWorkflowStep(3, 'completed');
         
         return {
           content: `${websearchResult.content}\n\n**Analyse approfondie des documents:**\n${docQAResult.content}`,
           sources: [...websearchResult.sources, ...docQAResult.sources],
           rawApiResponse: docQAResult.rawApiResponse,
           workflowPath: ['Document Library', 'Websearch', 'Document Q&A'],
           stepName: 'Document Q&A'
         };
       } else {
         // Pas de PDF, retourner les résultats du websearch
         return {
           ...websearchResult,
           workflowPath: ['Document Library', 'Websearch']
         };
       }

    } catch (error) {
       setWorkflowSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));
       console.error('Erreur dans le workflow:', error);
       throw error;
     }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
      sources: []
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await executeWorkflow(inputMessage);

      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: response.content,
        timestamp: new Date(),
        sources: response.sources || [],
        rawApiResponse: response.rawApiResponse,
        workflowPath: response.workflowPath || [],
        stepName: response.stepName || 'Workflow'
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Erreur détaillée dans handleSendMessage:', error);
      console.error('Stack trace:', error.stack);
      console.error('Message d\'erreur:', error.message);
      
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        content: `Désolé, je rencontre actuellement des difficultés techniques. Veuillez réessayer dans quelques instants ou contactez directement l'IAE Lyon 3.\n\nErreur technique: ${error.message}`,
        timestamp: new Date(),
        sources: []
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="bg-white shadow-lg border-b-4 border-blue-600">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-600 p-3 rounded-xl">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Assistant IAE Lyon 3</h1>
                <p className="text-gray-600">Intelligence artificielle • Recherche web spécialisée</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Search className="w-4 h-4" />
              <span>Powered by Mistral AI</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {debugInfo && (
          <div className="mb-4 bg-blue-50 rounded-xl p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">🔍 Debug Info</h3>
            <div className="bg-white rounded-lg border border-blue-200 p-3 text-xs font-mono whitespace-pre-wrap text-gray-700 max-h-40 overflow-y-auto">
              {debugInfo}
            </div>
          </div>
        )}
        
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="h-[600px] overflow-y-auto p-6 space-y-6">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex items-start space-x-3 max-w-4xl ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`p-2 rounded-full ${message.type === 'user' ? 'bg-blue-600' : 'bg-gray-100'}`}>
                    {message.type === 'user' ? 
                      <User className="w-5 h-5 text-white" /> : 
                      <Bot className="w-5 h-5 text-blue-600" />
                    }
                  </div>
                  <div className={`p-4 rounded-2xl ${message.type === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-800'}`}>
                    <div className="text-sm leading-relaxed prose prose-sm max-w-none">
                      {message.type === 'user' ? (
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      ) : (
                        <div className="prose-headings:text-gray-800 prose-p:text-gray-800 prose-strong:text-gray-900 prose-em:text-gray-700 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-100 prose-pre:text-gray-800 prose-blockquote:border-l-blue-500 prose-blockquote:text-gray-700 prose-ul:text-gray-800 prose-ol:text-gray-800 prose-li:text-gray-800">
                          <ReactMarkdown>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                    {message.workflowPath && message.workflowPath.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 mb-2">Workflow exécuté :</p>
                        <div className="flex items-center space-x-2 flex-wrap">
                          {message.workflowPath.map((step, index) => (
                            <div key={index} className="flex items-center space-x-1">
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                                {step}
                              </span>
                              {index < message.workflowPath.length - 1 && (
                                <span className="text-gray-400 text-xs">→</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-600 mb-2">Sources :</p>
                        <div className="space-y-2">
                          {message.sources.map((source, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <ExternalLink className="w-3 h-3 text-blue-500 flex-shrink-0" />
                              <a 
                                href={source.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:text-blue-800 underline truncate"
                              >
                                {source.title}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="text-xs opacity-70 mt-2">
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-3 max-w-4xl">
                  <div className="p-2 rounded-full bg-gray-100">
                    <Bot className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="p-4 rounded-2xl bg-gray-50">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        <span className="text-sm text-gray-600">
                          {agents.documentLibrary ? 'Exécution du workflow agentic...' : 'Initialisation des agents Mistral...'}
                        </span>
                      </div>
                      
                      {agents.documentLibrary && (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-gray-700 mb-2">Workflow en cours :</div>
                          {workflowSteps.map((step) => (
                            <div key={step.id} className="flex items-center space-x-2">
                              <div className={`w-3 h-3 rounded-full ${
                                step.status === 'completed' ? 'bg-green-500' :
                                step.status === 'active' ? 'bg-blue-500 animate-pulse' :
                                'bg-gray-300'
                              }`}></div>
                              <span className={`text-xs ${
                                step.status === 'completed' ? 'text-green-700' :
                                step.status === 'active' ? 'text-blue-700 font-medium' :
                                'text-gray-500'
                              }`}>
                                {step.name}
                              </span>
                              {step.status === 'active' && (
                                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <div className="p-6 border-t border-gray-100 bg-gray-50">
            <div className="flex space-x-4">
              <div className="flex-1">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Posez votre question sur l'IAE Lyon 3..."
                  className="w-full p-4 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  rows="2"
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ✨ Recherche intelligente limitée au domaine iae.univ-lyon3.fr
            </p>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 rounded-xl p-6 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-3">🤖 Intégration Mistral AI activée</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-blue-800">
            <div>
              <p className="font-medium mb-1">Agent spécialisé</p>
              <p>Utilise l'API Mistral AI avec websearch pour des réponses précises et actualisées.</p>
            </div>
            <div>
              <p className="font-medium mb-1">Recherche ciblée</p>
              <p>Recherche uniquement sur iae.univ-lyon3.fr grâce aux instructions avancées de l'agent.</p>
            </div>
            <div>
              <p className="font-medium mb-1">Sources vérifiées</p>
              <p>Chaque réponse inclut les liens vers les pages sources officielles de l'IAE.</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-green-100 rounded-lg border border-green-200">
            <p className="text-green-800 text-sm">
              ✅ <strong>API Mistral connectée</strong> - Agent: {agentId ? agentId.substring(0, 20) + '...' : 'En cours...'}
              {conversationId && <><br/>💬 Conversation: {conversationId.substring(0, 15)}...</>}
            </p>
          </div>
        </div>

        <div className="mt-6 bg-gray-50 rounded-xl p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3">📋 Logs API Workflow Agentic Mistral</h3>
          <div className="bg-white rounded-lg border border-gray-200 p-4 max-h-96 overflow-y-auto">
            {messages.length > 0 ? (
              <div className="space-y-6">
                {messages.map((message, index) => (
                  message.type === 'bot' && message.rawApiResponse && (
                    <div key={index} className="border-b border-gray-100 pb-6 last:border-b-0">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">
                          🔍 Réponse API #{messages.filter(m => m.type === 'bot').indexOf(message) + 1} - {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                            {message.stepName || 'Workflow Agentic'}
                          </span>
                          {message.workflowPath && message.workflowPath.length > 0 && (
                            <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                              {message.workflowPath.join(' → ')}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Conversation ID */}
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                        <h4 className="text-xs font-semibold text-blue-800 mb-1">📞 Conversation ID</h4>
                        <p className="text-xs font-mono text-blue-700">{message.rawApiResponse.conversation_id}</p>
                      </div>

                      {/* Tool Executions */}
                      {message.rawApiResponse.outputs.filter(output => output.type === 'tool.execution').map((toolExec, toolIndex) => (
                        <div key={toolIndex} className="mb-4 p-3 bg-yellow-50 rounded-lg">
                          <h4 className="text-xs font-semibold text-yellow-800 mb-2">🔧 Tool Execution</h4>
                          <div className="space-y-1 text-xs">
                            <p><span className="font-medium text-yellow-700">Name:</span> <span className="font-mono">{toolExec.name}</span></p>
                            <p><span className="font-medium text-yellow-700">Type:</span> <span className="font-mono">{toolExec.type}</span></p>
                            <p><span className="font-medium text-yellow-700">Object:</span> <span className="font-mono">{toolExec.object}</span></p>
                            <p><span className="font-medium text-yellow-700">ID:</span> <span className="font-mono">{toolExec.id}</span></p>
                            <p><span className="font-medium text-yellow-700">Created:</span> <span className="font-mono">{new Date(toolExec.created_at).toLocaleString()}</span></p>
                            <p><span className="font-medium text-yellow-700">Completed:</span> <span className="font-mono">{new Date(toolExec.completed_at).toLocaleString()}</span></p>
                          </div>
                        </div>
                      ))}

                      {/* Message Output */}
                      {message.rawApiResponse.outputs.filter(output => output.type === 'message.output').map((msgOutput, msgIndex) => (
                        <div key={msgIndex} className="mb-4 p-3 bg-green-50 rounded-lg">
                          <h4 className="text-xs font-semibold text-green-800 mb-2">💬 Message Output</h4>
                          <div className="space-y-2 text-xs">
                            <div>
                              <p><span className="font-medium text-green-700">Type:</span> <span className="font-mono">{msgOutput.type}</span></p>
                              <p><span className="font-medium text-green-700">Object:</span> <span className="font-mono">{msgOutput.object}</span></p>
                              <p><span className="font-medium text-green-700">ID:</span> <span className="font-mono">{msgOutput.id}</span></p>
                              <p><span className="font-medium text-green-700">Agent ID:</span> <span className="font-mono">{msgOutput.agent_id}</span></p>
                              <p><span className="font-medium text-green-700">Model:</span> <span className="font-mono">{msgOutput.model}</span></p>
                              <p><span className="font-medium text-green-700">Role:</span> <span className="font-mono">{msgOutput.role}</span></p>
                              <p><span className="font-medium text-green-700">Created:</span> <span className="font-mono">{new Date(msgOutput.created_at).toLocaleString()}</span></p>
                              <p><span className="font-medium text-green-700">Completed:</span> <span className="font-mono">{new Date(msgOutput.completed_at).toLocaleString()}</span></p>
                            </div>
                            
                            {/* Content Chunks */}
                            <div className="mt-3">
                              <h5 className="font-medium text-green-700 mb-2">📝 Content Chunks:</h5>
                              {msgOutput.content.map((chunk, chunkIndex) => (
                                <div key={chunkIndex} className="mb-2 p-2 bg-white rounded border">
                                  <p><span className="font-medium">Type:</span> <span className="font-mono text-purple-600">{chunk.type}</span></p>
                                  {chunk.type === 'text' && (
                                    <p className="mt-1"><span className="font-medium">Text:</span> <span className="text-gray-700">{chunk.text}</span></p>
                                  )}
                                  {chunk.type === 'tool_reference' && (
                                    <div className="mt-1 space-y-1">
                                      <p><span className="font-medium">Tool:</span> <span className="font-mono text-blue-600">{chunk.tool}</span></p>
                                      <p><span className="font-medium">Title:</span> <span className="text-gray-700">{chunk.title}</span></p>
                                      <p><span className="font-medium">URL:</span> <a href={chunk.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">{chunk.url}</a></p>
                                      <p><span className="font-medium">Source:</span> <span className="font-mono text-orange-600">{chunk.source}</span></p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Usage Statistics */}
                      {message.rawApiResponse.usage && (
                        <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                          <h4 className="text-xs font-semibold text-purple-800 mb-2">📊 Usage Statistics</h4>
                          <div className="space-y-1 text-xs">
                            <p><span className="font-medium text-purple-700">Prompt Tokens:</span> <span className="font-mono">{message.rawApiResponse.usage.prompt_tokens}</span></p>
                            <p><span className="font-medium text-purple-700">Completion Tokens:</span> <span className="font-mono">{message.rawApiResponse.usage.completion_tokens}</span></p>
                            <p><span className="font-medium text-purple-700">Total Tokens:</span> <span className="font-mono">{message.rawApiResponse.usage.total_tokens}</span></p>
                            <p><span className="font-medium text-purple-700">Connector Tokens:</span> <span className="font-mono">{message.rawApiResponse.usage.connector_tokens}</span></p>
                            {message.rawApiResponse.usage.connectors && (
                              <div className="mt-2">
                                <p className="font-medium text-purple-700">Connectors Used:</p>
                                {Object.entries(message.rawApiResponse.usage.connectors).map(([connector, count]) => (
                                  <p key={connector} className="ml-2"><span className="font-mono">{connector}: {count}</span></p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Raw JSON */}
                      <div className="p-3 bg-gray-100 rounded-lg">
                        <h4 className="text-xs font-semibold text-gray-800 mb-2">🔍 JSON Complet</h4>
                        <div className="bg-gray-900 rounded p-3 text-xs font-mono text-green-400 whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto">
                          {JSON.stringify(message.rawApiResponse, null, 2)}
                        </div>
                      </div>
                    </div>
                  )
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <p className="text-sm">Aucune réponse API disponible</p>
                <p className="text-xs mt-1">Les réponses détaillées du workflow agentic Mistral apparaîtront ici</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
