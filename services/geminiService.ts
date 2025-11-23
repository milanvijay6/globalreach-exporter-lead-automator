
import { GoogleGenAI, Type } from "@google/genai";
import { Importer, Message, LeadStatus, AnalysisResult, SalesForecast, Channel, AppTemplates, OptimizationInsight, StrategicInsight, TrainingModule, ApiKeyProvider } from "../types";
import { checkRateLimit } from "./securityService";
import { getPrimaryKey, getDecryptedKeyValue, onKeyChange } from "./apiKeyService";
import { selectBestKey, recordUsage } from "./apiKeyOptimizer";
import { ApiKeyUsage } from "../types";
import { onCacheInvalidation } from "./apiKeyCache";

// Initialize the client - will be done dynamically with API key from service
let ai: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

/**
 * Clears the cached AI client to force refresh on next use
 */
const clearAiClientCache = () => {
  ai = null;
  currentApiKey = null;
};

// Listen for key changes and invalidate cache
onKeyChange((event, keyId, provider) => {
  if (provider === ApiKeyProvider.GEMINI) {
    clearAiClientCache();
  }
});

// Listen for cache invalidation events
onCacheInvalidation(() => {
  clearAiClientCache();
});

/**
 * Gets or initializes the Gemini AI client with the best available API key
 */
const getAiClient = async (): Promise<GoogleGenAI> => {
  try {
    // Try to get the best key from the optimizer
    const bestKey = await selectBestKey(ApiKeyProvider.GEMINI, { priority: 'reliability' });
    
    if (bestKey) {
      const decryptedKey = await getDecryptedKeyValue(bestKey.id);
      if (decryptedKey && decryptedKey !== currentApiKey) {
        currentApiKey = decryptedKey;
        ai = new GoogleGenAI({ apiKey: decryptedKey });
      }
    } else {
      // Fallback to primary key
      const primaryKey = await getPrimaryKey(ApiKeyProvider.GEMINI);
      if (primaryKey) {
        const decryptedKey = await getDecryptedKeyValue(primaryKey.id);
        if (decryptedKey && decryptedKey !== currentApiKey) {
          currentApiKey = decryptedKey;
          ai = new GoogleGenAI({ apiKey: decryptedKey });
        }
      } else {
        // Last resort: try environment variable (for backward compatibility)
        const envKey = process.env.API_KEY || '';
        if (envKey && envKey !== currentApiKey) {
          currentApiKey = envKey;
          ai = new GoogleGenAI({ apiKey: envKey });
        }
      }
    }
    
    if (!ai) {
      throw new Error('No Gemini API key available. Please add an API key in Settings > API Keys.');
    }
    
    return ai;
  } catch (error) {
    console.error('[GeminiService] Failed to get API key:', error);
    // Fallback to environment variable
    const envKey = process.env.API_KEY || '';
    if (envKey) {
      ai = new GoogleGenAI({ apiKey: envKey });
      return ai;
    }
    throw new Error('No Gemini API key available. Please configure an API key in Settings.');
  }
};

/**
 * Records usage for an API call
 */
const recordApiUsage = async (keyId: string, success: boolean, responseTime?: number, error?: string) => {
  try {
    await recordUsage(keyId, {
      keyId,
      timestamp: Date.now(),
      provider: ApiKeyProvider.GEMINI,
      action: 'gemini_api_call',
      success,
      responseTime,
      errorMessage: error,
    });
  } catch (error) {
    // Don't fail the main operation if usage tracking fails
    console.error('[GeminiService] Failed to record usage:', error);
  }
};

const MODEL_NAME = 'gemini-2.5-flash';

const replacePlaceholders = (template: string, values: Record<string, string>) => {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] || `{{${key}}}`);
};

/**
 * Generates the initial introductory message based on a customizable template.
 * Adapts format based on target channel (Email vs Chat).
 * Now enhanced with lead research for deeper personalization.
 */
export const generateIntroMessage = async (
  importer: Importer, 
  myCompany: string, 
  myProduct: string,
  template: string,
  targetChannel: Channel,
  useResearch: boolean = true
): Promise<string> => {
  
  if (!checkRateLimit()) {
    return "Error: Rate limit exceeded. Please wait a moment.";
  }

  // Get lead research if enabled
  let researchContext = '';
  if (useResearch) {
    try {
      const { LeadResearchService } = await import('./leadResearchService');
      const research = await LeadResearchService.researchLead(importer);
      researchContext = `
        Lead Research Insights:
        - Industry: ${research.industry}
        - Pain Points: ${research.painPoints.join(', ') || 'Not identified'}
        - Opportunities: ${research.opportunities.join(', ') || 'Not identified'}
        - Recommended Approach: ${research.recommendedApproach}
        - Personalization Tips: ${research.personalizationTips.join('; ') || 'None'}
      `;
    } catch (error) {
      console.warn('[GeminiService] Failed to get lead research, continuing without it:', error);
    }
  }

  const filledTemplate = replacePlaceholders(template, {
    importerName: importer.name,
    companyName: importer.companyName,
    country: importer.country,
    productCategory: importer.productsImported, // Using imports as category proxy
    myProduct: myProduct,
    myCompany: myCompany
  });

  const prompt = `
    You are a professional export sales representative.
    
    Target Channel: ${targetChannel}
    
    ${researchContext ? `\n${researchContext}\n` : ''}
    
    Task: Create a highly personalized introductory message based on the template below.
    ${researchContext ? 'Use the lead research insights to craft a message that addresses their specific needs and pain points.' : ''}
    Ensure it is polite, professional, and formatted for the specific target channel.
    
    Channel Constraints:
    ${targetChannel === Channel.EMAIL 
        ? '- Include a professional Subject line at the very top (Format: "Subject: ...").\n- Use standard email signing.' 
        : '- Do NOT include a Subject line.\n- Keep it concise and chat-friendly.\n- Break into small paragraphs.'}

    Base Template:
    """
    ${filledTemplate}
    """
    
    ${researchContext ? 'IMPORTANT: Customize the message to be highly relevant to this specific lead based on the research insights. Avoid generic messaging.' : ''}
    
    Output ONLY the final message text.
  `;

  try {
    const client = await getAiClient();
    const startTime = Date.now();
    
    // Get the key ID for usage tracking
    const bestKey = await selectBestKey(ApiKeyProvider.GEMINI, { priority: 'reliability' });
    const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
    
    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });
    
    const responseTime = Date.now() - startTime;
    await recordApiUsage(keyId, true, responseTime);
    
    return response.text || "Error generating message.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // Record failed usage
    try {
      const bestKey = await selectBestKey(ApiKeyProvider.GEMINI);
      const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
      await recordApiUsage(keyId, false, undefined, error.message);
    } catch (trackError) {
      // Ignore tracking errors
    }
    
    return "Could not generate intro message. Please check API Key.";
  }
};

/**
 * Generates a context-aware reply to the importer using custom instructions and retained context.
 * Uses cross-channel history to maintain continuity.
 */
export const generateAgentReply = async (
  importer: Importer, 
  history: Message[], 
  myCompany: string, 
  systemInstructionTemplate: string,
  targetChannel: Channel
): Promise<string> => {
  
  if (!checkRateLimit()) {
    return "Error: Rate limit exceeded. Please wait a moment.";
  }

  // Include Channel in history for context awareness
  const conversation = history.map(m => `[${m.channel}] ${m.sender.toUpperCase()}: ${m.content}`).join('\n');
  
  // Context Retention: Explicitly feed back the AI's own previous understanding
  const contextBlock = `
    Context Summary: ${importer.conversationSummary || 'Starting conversation.'}
    Identified Interest: ${importer.interestShownIn || 'Not yet identified.'}
    Next Goal: ${importer.nextStep || 'Qualify lead.'}
  `;

  const filledInstruction = replacePlaceholders(systemInstructionTemplate, {
    myCompany: myCompany
  });

  const prompt = `
    ${filledInstruction}

    Target Channel: ${targetChannel}
    Instruction: Adapt your response format for ${targetChannel}.
    ${targetChannel !== Channel.EMAIL 
        ? 'Keep it concise (under 60 words if possible) as this is a chat app. No formal subject lines.' 
        : 'Use standard business email formatting.'}

    Importer Details:
    Name: ${importer.name} (${importer.companyName}, ${importer.country})
    Imports: ${importer.productsImported}

    ${contextBlock}
    
    Conversation History (Note the channels used):
    ${conversation}

    Output ONLY the reply text.
  `;

  try {
    const client = await getAiClient();
    const startTime = Date.now();
    
    const bestKey = await selectBestKey(ApiKeyProvider.GEMINI, { priority: 'reliability' });
    const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
    
    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });
    
    const responseTime = Date.now() - startTime;
    await recordApiUsage(keyId, true, responseTime);
    
    return response.text || "Error generating reply.";
  } catch (error: any) {
    console.error("Gemini API Reply Error:", error);
    
    try {
      const bestKey = await selectBestKey(ApiKeyProvider.GEMINI);
      const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
      await recordApiUsage(keyId, false, undefined, error.message);
    } catch (trackError) {
      // Ignore tracking errors
    }
    
    return "System Error: AI unavailable.";
  }
};

/**
 * Analyzes the conversation to determine lead status, extract details, detect escalation needs, and score the lead.
 */
export const analyzeLeadQuality = async (history: Message[]): Promise<AnalysisResult> => {
  
  if (!checkRateLimit()) {
     console.warn("Rate limit hit skipping analysis");
     return {
      status: LeadStatus.ENGAGED,
      summary: "Rate limit skipped analysis",
      nextStep: "Continue conversation",
      interestShownIn: "Unknown",
      requiresHumanReview: false,
      leadScore: 50,
      satisfactionIndex: 50,
      sentiment: { label: 'Neutral', score: 0, intensity: 0 },
      emotions: []
    };
  }

  const conversation = history.map(m => `[${m.channel}] ${m.sender.toUpperCase()}: ${m.content}`).join('\n');

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      status: {
        type: Type.STRING,
        enum: [
          LeadStatus.INTERESTED,
          LeadStatus.NEGOTIATION,
          LeadStatus.SAMPLE_SENT,
          LeadStatus.CLOSED,
          LeadStatus.COLD,
          LeadStatus.ENGAGED
        ]
      },
      summary: { type: Type.STRING },
      nextStep: { type: Type.STRING },
      interestShownIn: { type: Type.STRING },
      requiresHumanReview: { type: Type.BOOLEAN },
      leadScore: { type: Type.INTEGER, description: "0-100 Buying Intent" },
      satisfactionIndex: { type: Type.INTEGER, description: "0-100 Overall Engagement Quality / Happiness" },
      
      sentiment: {
          type: Type.OBJECT,
          properties: {
              label: { type: Type.STRING, enum: ["Positive", "Neutral", "Negative", "Critical"] },
              score: { type: Type.NUMBER, description: "-1.0 to 1.0" },
              intensity: { type: Type.NUMBER, description: "0.0 to 1.0" }
          },
          required: ["label", "score", "intensity"]
      },
      
      emotions: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                label: { type: Type.STRING, enum: ['Frustration', 'Confusion', 'Enthusiasm', 'Urgency', 'Skepticism', 'Gratitude'] },
                confidence: { type: Type.NUMBER, description: "0.0 to 1.0" }
            },
            required: ["label", "confidence"]
        }
      }
    },
    required: ["status", "summary", "nextStep", "interestShownIn", "requiresHumanReview", "sentiment", "leadScore", "satisfactionIndex", "emotions"]
  };

  const prompt = `
    Analyze this sales conversation.
    
    Tasks:
    1. Status & Summary.
    2. Buying Intent (Lead Score 0-100).
    3. Engagement Quality / Happiness (Satisfaction Index 0-100).
    
    4. Sentiment Scoring:
       - Polarity Score: -1.0 (Very Negative) to +1.0 (Very Positive).
       - Intensity: 0.0 (Weak) to 1.0 (Strong).
    
    5. Emotion Detection (Multi-label):
       - Assign a confidence score (0.0-1.0) for any detected emotions:
       - Frustration, Confusion, Enthusiasm, Urgency, Skepticism, Gratitude.

    Conversation:
    ${conversation}
  `;

  try {
    const client = await getAiClient();
    const startTime = Date.now();
    
    const bestKey = await selectBestKey(ApiKeyProvider.GEMINI, { priority: 'reliability' });
    const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
    
    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const responseTime = Date.now() - startTime;
    await recordApiUsage(keyId, true, responseTime);

    const jsonText = response.text || "{}";
    return JSON.parse(jsonText) as AnalysisResult;
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    
    try {
      const bestKey = await selectBestKey(ApiKeyProvider.GEMINI);
      const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
      await recordApiUsage(keyId, false, undefined, error.message);
    } catch (trackError) {
      // Ignore tracking errors
    }
    return {
      status: LeadStatus.ENGAGED,
      summary: "Analysis failed",
      nextStep: "Manual Review",
      interestShownIn: "Unknown",
      requiresHumanReview: true,
      leadScore: 0,
      satisfactionIndex: 0,
      sentiment: { label: 'Neutral', score: 0, intensity: 0 },
      emotions: []
    };
  }
};

/**
 * AI Optimization Logic
 * Takes examples of good vs bad interactions and proposes improved templates.
 */
export const analyzeAndOptimize = async (
  successfulExcerpts: string,
  failedExcerpts: string,
  currentTemplates: AppTemplates
): Promise<OptimizationInsight> => {
    
    if (!checkRateLimit()) throw new Error("Rate Limit Exceeded");

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedIntro: { type: Type.STRING },
            suggestedSystemInstruction: { type: Type.STRING },
            reasoning: { type: Type.STRING }
        },
        required: ["strengths", "weaknesses", "suggestedIntro", "suggestedSystemInstruction", "reasoning"]
    };

    const prompt = `
      You are an expert CRM optimization consultant.
      Your goal is to improve the AI Agent's performance by analyzing historical data.

      1. Analyze the 'Successful Patterns' (Conversations that led to high satisfaction/deals).
      2. Analyze the 'Failed Patterns' (Conversations that led to anger, confusion, or lost deals).
      3. Critique the 'Current System Instructions'.
      4. Generate IMPROVED templates (Intro & System Instruction) that incorporate the winning patterns and avoid the failure modes.

      Current Intro Template:
      "${currentTemplates.introTemplate}"

      Current System Instruction:
      "${currentTemplates.agentSystemInstruction}"

      ---
      Successful Patterns (Excerpts):
      ${successfulExcerpts || "No data available yet."}
      
      ---
      Failed Patterns (Excerpts):
      ${failedExcerpts || "No data available yet."}
      ---

      Output a structured analysis with your suggested improvements.
    `;

    try {
        const client = await getAiClient();
        const startTime = Date.now();
        
        const bestKey = await selectBestKey(ApiKeyProvider.GEMINI, { priority: 'reliability' });
        const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
        
        const response = await client.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            }
        });
        
        const responseTime = Date.now() - startTime;
        await recordApiUsage(keyId, true, responseTime);
        
        const jsonText = response.text || "{}";
        return JSON.parse(jsonText) as OptimizationInsight;
    } catch (error: any) {
        console.error("Optimization Error", error);
        
        try {
          const bestKey = await selectBestKey(ApiKeyProvider.GEMINI);
          const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
          await recordApiUsage(keyId, false, undefined, error.message);
        } catch (trackError) {
          // Ignore tracking errors
        }
        
        throw error;
    }
};

/**
 * Generates comprehensive lead research using AI
 */
export const generateLeadResearch = async (context: any): Promise<{
  summary: string;
  industry: string;
  companySize?: string;
  businessModel?: string;
  painPoints: string[];
  opportunities: string[];
  recommendedApproach: string;
  personalizationTips: string[];
}> => {
  if (!checkRateLimit()) {
    throw new Error("Rate Limit Exceeded");
  }

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
      industry: { type: Type.STRING },
      companySize: { type: Type.STRING },
      businessModel: { type: Type.STRING },
      painPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
      opportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
      recommendedApproach: { type: Type.STRING },
      personalizationTips: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["summary", "industry", "painPoints", "opportunities", "recommendedApproach", "personalizationTips"],
  };

  const prompt = `
    You are a lead research analyst. Analyze the following lead data and generate comprehensive research insights.
    
    Lead Data:
    - Name: ${context.name}
    - Company: ${context.company}
    - Country: ${context.country}
    - Products Imported: ${context.productsImported}
    - Quantity: ${context.quantity || 'Not specified'}
    - Price Range: ${context.priceRange || 'Not specified'}
    - Current Status: ${context.status}
    - Lead Score: ${context.leadScore || 'Not calculated'}
    - Satisfaction Index: ${context.satisfactionIndex || 'Not calculated'}
    - Conversation Summary: ${context.conversationSummary || 'No previous conversation'}
    - Interest Shown: ${context.interestShownIn || 'Not identified'}
    - Next Step: ${context.nextStep || 'Not defined'}
    
    Previous Interactions:
    ${context.previousMessages?.length > 0 
      ? context.previousMessages.map((m: any) => `- [${m.channel}] ${new Date(m.date).toLocaleDateString()}: ${m.summary}`).join('\n')
      : 'No previous interactions'}
    
    Activity Log:
    ${context.activityLog?.length > 0
      ? context.activityLog.map((log: any) => `- ${log.type}: ${log.description}`).join('\n')
      : 'No activity log'}
    
    Tasks:
    1. Analyze the lead's business profile and infer industry, company size, and business model
    2. Identify potential pain points based on their import patterns and location
    3. Identify opportunities for engagement based on their needs
    4. Recommend the best approach for initial contact
    5. Provide specific personalization tips for crafting a highly relevant message
    
    Focus on making the research actionable for creating personalized outreach messages.
  `;

  try {
    const client = await getAiClient();
    const startTime = Date.now();
    
    const bestKey = await selectBestKey(ApiKeyProvider.GEMINI, { priority: 'reliability' });
    const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
    
    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });
    
    const responseTime = Date.now() - startTime;
    await recordApiUsage(keyId, true, responseTime);
    
    const jsonText = response.text || "{}";
    return JSON.parse(jsonText);
  } catch (error: any) {
    console.error("Lead Research Error:", error);
    
    try {
      const bestKey = await selectBestKey(ApiKeyProvider.GEMINI);
      const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
      await recordApiUsage(keyId, false, undefined, error.message);
    } catch (trackError) {
      // Ignore tracking errors
    }
    
    // Return default research
    return {
      summary: `Basic research for ${context.company} in ${context.country}`,
      industry: 'Import/Export',
      painPoints: [],
      opportunities: [],
      recommendedApproach: 'Standard professional outreach',
      personalizationTips: ['Mention their country', 'Reference their import products'],
    };
    }
};

/**
 * SIMULATION ONLY
 */
export const simulateImporterResponse = async (importer: Importer, history: Message[]): Promise<string> => {
  if (!checkRateLimit()) return "Rate Limit: System busy.";

  const conversation = history.map(m => `${m.sender.toUpperCase()}: ${m.content}`).join('\n');
  
  const prompt = `
    Roleplay Mode: You are ${importer.name}, a busy importer.
    History:
    ${conversation}
    
    Reply to the last message. Be realistic. Keep it under 40 words.
  `;

  try {
    const client = await getAiClient();
    const startTime = Date.now();
    
    const bestKey = await selectBestKey(ApiKeyProvider.GEMINI, { priority: 'reliability' });
    const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
    
    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });
    
    const responseTime = Date.now() - startTime;
    await recordApiUsage(keyId, true, responseTime);
    
    return response.text || "...";
  } catch (error: any) {
    try {
      const bestKey = await selectBestKey(ApiKeyProvider.GEMINI);
      const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
      await recordApiUsage(keyId, false, undefined, error.message);
    } catch (trackError) {
      // Ignore tracking errors
    }
    return "Interested, please send details.";
  }
};

export const generateCampaignMessage = async (
  importer: Importer, 
  myCompany: string, 
  myProduct: string,
  stepTemplate: string,
  targetChannel: Channel
): Promise<string> => {
   // Reuse intro generator logic but for campaigns (which use same template engine)
   return generateIntroMessage(importer, myCompany, myProduct, stepTemplate, targetChannel);
};

/**
 * Generates a sales trend forecast based on current lead data.
 */
export const generateSalesForecast = async (importers: Importer[]): Promise<SalesForecast[]> => {
    if (!checkRateLimit()) return [];

    const leadSummary = importers
        .filter(i => i.status !== LeadStatus.CLOSED && i.status !== LeadStatus.COLD)
        .map(i => ({
            score: i.leadScore || 50,
            status: i.status,
            lastActive: i.lastContacted
        }));

    const responseSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                date: { type: Type.STRING, description: "Date label (e.g., 'Week 1', 'Nov 12')" },
                predictedConversions: { type: Type.INTEGER },
                confidence: { type: Type.NUMBER, description: "0.0 to 1.0" }
            },
            required: ["date", "predictedConversions", "confidence"]
        }
    };

    const prompt = `
        Analyze these anonymized lead metrics to forecast sales conversions for the next 4 weeks.
        
        Metrics: ${JSON.stringify(leadSummary.slice(0, 50))}
        
        Logic:
        - High lead scores (>70) close faster.
        - Negotiation status implies imminent closure.
        - Sample Sent implies medium term closure.
        
        Output 4 data points representing the next 4 weeks.
    `;

    try {
        const client = await getAiClient();
        const startTime = Date.now();
        
        const bestKey = await selectBestKey(ApiKeyProvider.GEMINI, { priority: 'reliability' });
        const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
        
        const response = await client.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            }
        });
        
        const responseTime = Date.now() - startTime;
        await recordApiUsage(keyId, true, responseTime);
        
        const jsonText = response.text || "[]";
        return JSON.parse(jsonText) as SalesForecast[];
    } catch (error: any) {
        console.error("Forecast Error", error);
        
        try {
          const bestKey = await selectBestKey(ApiKeyProvider.GEMINI);
          const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
          await recordApiUsage(keyId, false, undefined, error.message);
        } catch (trackError) {
          // Ignore tracking errors
        }
        // Fallback mock data
        return [
            { date: 'Week 1', predictedConversions: 2, confidence: 0.8 },
            { date: 'Week 2', predictedConversions: 5, confidence: 0.6 },
            { date: 'Week 3', predictedConversions: 3, confidence: 0.5 },
            { date: 'Week 4', predictedConversions: 1, confidence: 0.4 },
        ];
    }
};

/**
 * Generates targeted training modules based on strategic insights from lead data.
 */
export const generateTrainingProgram = async (insights: StrategicInsight[]): Promise<TrainingModule[]> => {
  if (!checkRateLimit()) throw new Error("Rate Limit Exceeded");

  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING },
        focusArea: { type: Type.STRING, enum: ['Empathy', 'Technique', 'Intervention'] },
        description: { type: Type.STRING },
        scenarios: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              situation: { type: Type.STRING },
              poorResponse: { type: Type.STRING },
              betterResponse: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ["situation", "poorResponse", "betterResponse", "explanation"]
          }
        },
        suggestedPhrases: { type: Type.ARRAY, items: { type: Type.STRING } },
        toneAdjustments: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["id", "title", "focusArea", "description", "scenarios", "suggestedPhrases", "toneAdjustments"]
    }
  };

  const prompt = `
    You are an expert Sales Trainer.
    Based on the following strategic insights derived from our CRM data, generate 3 specific training modules to improve team performance.
    
    Insights:
    ${JSON.stringify(insights.slice(0, 5))}
    
    Modules Required:
    1. Empathy Builder (Dealing with confusion/negativity).
    2. Success Replication (Reinforcing winning patterns).
    3. Critical Intervention (Handling urgency/anger).
    
    For each module, provide suggested phrases to use and tone adjustments.
  `;

  try {
    const client = await getAiClient();
    const startTime = Date.now();
    
    const bestKey = await selectBestKey(ApiKeyProvider.GEMINI, { priority: 'reliability' });
    const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
    
    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const responseTime = Date.now() - startTime;
    await recordApiUsage(keyId, true, responseTime);

    const jsonText = response.text || "[]";
    return JSON.parse(jsonText) as TrainingModule[];
  } catch (error: any) {
    console.error("Training Generation Error", error);
    
    try {
      const bestKey = await selectBestKey(ApiKeyProvider.GEMINI);
      const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
      await recordApiUsage(keyId, false, undefined, error.message);
    } catch (trackError) {
      // Ignore tracking errors
    }
    // Fallback
    return [];
  }
};
