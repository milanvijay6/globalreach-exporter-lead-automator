import { GoogleGenAI, Type } from "@google/genai";
import { LeadStatus, AnalysisResult, ApiKeyProvider } from "../types";
import { selectBestKey, getPrimaryKey, getDecryptedKeyValue } from "./apiKeyService";
import { recordUsage } from "./apiKeyOptimizer";
import { checkRateLimit } from "./securityService";

const MODEL_NAME = 'gemini-2.5-flash';

// Initialize the client - similar to geminiService
let ai: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

/**
 * Gets or initializes the Gemini AI client with the best available API key
 */
const getAiClient = async (): Promise<GoogleGenAI> => {
  try {
    const bestKey = await selectBestKey(ApiKeyProvider.GEMINI, { priority: 'reliability' });
    
    if (bestKey) {
      const decryptedKey = await getDecryptedKeyValue(bestKey.id);
      if (decryptedKey && decryptedKey !== currentApiKey) {
        currentApiKey = decryptedKey;
        ai = new GoogleGenAI({ apiKey: decryptedKey });
      }
    } else {
      const primaryKey = await getPrimaryKey(ApiKeyProvider.GEMINI);
      if (primaryKey) {
        const decryptedKey = await getDecryptedKeyValue(primaryKey.id);
        if (decryptedKey && decryptedKey !== currentApiKey) {
          currentApiKey = decryptedKey;
          ai = new GoogleGenAI({ apiKey: decryptedKey });
        }
      } else {
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
    console.error('[BatchLeadScoring] Failed to get API key:', error);
    const envKey = process.env.API_KEY || '';
    if (envKey) {
      ai = new GoogleGenAI({ apiKey: envKey });
      return ai;
    }
    throw new Error('No Gemini API key available. Please configure an API key in Settings.');
  }
};

export interface LeadData {
  companyName?: string;
  country?: string;
  productsImported?: string | string[];
  status?: string;
  lastContacted?: Date | string;
  leadId?: string; // Optional identifier for mapping results
}

export interface BatchScoringResult {
  leadId?: string;
  result: AnalysisResult;
  success: boolean;
  error?: string;
}

const BATCH_SIZE = parseInt(process.env.AI_BATCH_SIZE || '10', 10);

/**
 * Records API usage for batch operations
 */
const recordApiUsage = async (keyId: string, success: boolean, responseTime?: number, error?: string, leadCount?: number) => {
  try {
    await recordUsage(keyId, {
      keyId,
      timestamp: Date.now(),
      provider: ApiKeyProvider.GEMINI,
      action: 'gemini_batch_scoring',
      success,
      responseTime,
      errorMessage: error,
      metadata: { leadCount },
    });
  } catch (error) {
    console.error('[BatchLeadScoring] Failed to record usage:', error);
  }
};

/**
 * Scores a batch of leads (up to BATCH_SIZE) in a single Gemini API call
 */
export const batchScoreLeads = async (
  leads: LeadData[],
  options: { timeout?: number } = {}
): Promise<BatchScoringResult[]> => {
  if (!checkRateLimit()) {
    console.warn("[BatchLeadScoring] Rate limit hit, skipping batch scoring");
    return leads.map(lead => ({
      leadId: lead.leadId,
      result: {
        status: LeadStatus.ENGAGED,
        summary: "Rate limit skipped analysis",
        nextStep: "Continue conversation",
        interestShownIn: "Unknown",
        requiresHumanReview: false,
        leadScore: 50,
        satisfactionIndex: 50,
        sentiment: { label: 'Neutral', score: 0, intensity: 0 },
        emotions: []
      },
      success: false,
      error: "Rate limit exceeded"
    }));
  }

  if (leads.length === 0) {
    return [];
  }

  // Limit batch size
  const batch = leads.slice(0, BATCH_SIZE);
  const remaining = leads.slice(BATCH_SIZE);

  try {
    const client = await getAiClient();
    const startTime = Date.now();

    const bestKey = await selectBestKey(ApiKeyProvider.GEMINI, { priority: 'reliability' });
    const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';

    // Build batch prompt
    const leadsData = batch.map((lead, index) => ({
      index: index + 1,
      companyName: lead.companyName || 'Unknown',
      country: lead.country || 'Unknown',
      productsImported: Array.isArray(lead.productsImported) 
        ? lead.productsImported.join(', ') 
        : (lead.productsImported || 'Unknown'),
      status: lead.status || 'Unknown',
      lastContacted: lead.lastContacted 
        ? (typeof lead.lastContacted === 'string' ? lead.lastContacted : lead.lastContacted.toISOString())
        : 'Never',
      leadId: lead.leadId || `lead_${index + 1}`
    }));

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        scores: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              leadIndex: { type: Type.INTEGER, description: "Index of the lead (1-based)" },
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
            required: ["leadIndex", "status", "summary", "nextStep", "interestShownIn", "requiresHumanReview", "sentiment", "leadScore", "satisfactionIndex", "emotions"]
          }
        }
      },
      required: ["scores"]
    };

    const prompt = `
      Analyze the following ${batch.length} leads and provide a comprehensive analysis for each.
      
      For each lead, provide:
      1. Status & Summary
      2. Buying Intent (Lead Score 0-100)
      3. Engagement Quality / Happiness (Satisfaction Index 0-100)
      4. Sentiment Scoring:
         - Polarity Score: -1.0 (Very Negative) to +1.0 (Very Positive)
         - Intensity: 0.0 (Weak) to 1.0 (Strong)
      5. Emotion Detection (Multi-label):
         - Assign confidence scores (0.0-1.0) for detected emotions: Frustration, Confusion, Enthusiasm, Urgency, Skepticism, Gratitude
      
      Leads Data:
      ${leadsData.map(lead => `
        Lead ${lead.index} (ID: ${lead.leadId}):
        - Company: ${lead.companyName}
        - Country: ${lead.country}
        - Products Imported: ${lead.productsImported}
        - Status: ${lead.status}
        - Last Contacted: ${lead.lastContacted}
      `).join('\n')}
      
      Return a JSON object with a "scores" array containing analysis for each lead, using the leadIndex to match results.
    `;

    // Set up timeout if provided
    let timeoutId: NodeJS.Timeout | null = null;
    const timeout = options.timeout || 30000; // Default 30s for background operations
    
    const abortController = new AbortController();
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);
    }

    try {
      const response = await client.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        },
      });

      if (timeoutId) clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      await recordApiUsage(keyId, true, responseTime, undefined, batch.length);

      const jsonText = response.text || "{}";
      const parsed = JSON.parse(jsonText) as { scores: any[] };

      // Map results back to leads
      const results: BatchScoringResult[] = batch.map((lead, index) => {
        const scoreData = parsed.scores?.find((s: any) => s.leadIndex === index + 1);
        
        if (scoreData) {
          return {
            leadId: lead.leadId,
            result: {
              status: scoreData.status as LeadStatus,
              summary: scoreData.summary || '',
              nextStep: scoreData.nextStep || '',
              interestShownIn: scoreData.interestShownIn || '',
              requiresHumanReview: scoreData.requiresHumanReview || false,
              leadScore: scoreData.leadScore || 0,
              satisfactionIndex: scoreData.satisfactionIndex || 0,
              sentiment: scoreData.sentiment || { label: 'Neutral', score: 0, intensity: 0 },
              emotions: scoreData.emotions || []
            },
            success: true
          };
        } else {
          // Fallback if result not found
          return {
            leadId: lead.leadId,
            result: {
              status: LeadStatus.ENGAGED,
              summary: "Analysis incomplete",
              nextStep: "Manual Review",
              interestShownIn: "Unknown",
              requiresHumanReview: true,
              leadScore: 50,
              satisfactionIndex: 50,
              sentiment: { label: 'Neutral', score: 0, intensity: 0 },
              emotions: []
            },
            success: false,
            error: "Result not found in batch response"
          };
        }
      });

      // If there are remaining leads, process them recursively
      if (remaining.length > 0) {
        const remainingResults = await batchScoreLeads(remaining, options);
        return [...results, ...remainingResults];
      }

      return results;
    } catch (error: any) {
      if (timeoutId) clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      const errorMessage = error?.error || error?.message || error?.details?.detail || String(error);
      await recordApiUsage(keyId, false, responseTime, errorMessage, batch.length);

      // Fallback to individual scoring if batch fails
      console.warn("[BatchLeadScoring] Batch scoring failed, falling back to individual calls:", errorMessage);
      return await fallbackToIndividualScoring(batch, options);
    }
  } catch (error: any) {
    console.error("[BatchLeadScoring] Error in batch scoring:", error);
    // Fallback to individual scoring
    return await fallbackToIndividualScoring(batch, options);
  }
};

/**
 * Fallback to individual lead scoring when batch fails
 */
const fallbackToIndividualScoring = async (
  leads: LeadData[],
  options: { timeout?: number } = {}
): Promise<BatchScoringResult[]> => {
  console.log(`[BatchLeadScoring] Falling back to individual scoring for ${leads.length} leads`);
  
  // Import the individual scoring function (we'll need to create a version that works with LeadData)
  // For now, return default results
  return leads.map(lead => ({
    leadId: lead.leadId,
    result: {
      status: LeadStatus.ENGAGED,
      summary: "Individual scoring unavailable, using default",
      nextStep: "Manual Review",
      interestShownIn: "Unknown",
      requiresHumanReview: true,
      leadScore: 50,
      satisfactionIndex: 50,
      sentiment: { label: 'Neutral', score: 0, intensity: 0 },
      emotions: []
    },
    success: false,
    error: "Batch scoring failed, individual fallback not implemented"
  }));
};


