
import { GoogleGenAI, Type } from "@google/genai";
import { Importer, Message, LeadStatus, AnalysisResult, SalesForecast, Channel, AppTemplates, OptimizationInsight, StrategicInsight, TrainingModule, ApiKeyProvider, Product } from "../types";
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
 * Gets company context for AI prompts
 */
const getCompanyContext = async (): Promise<string> => {
  try {
    const { CompanyConfigService } = await import('./companyConfigService');
    const company = await CompanyConfigService.getCompanyDetails();
    if (!company) return '';
    
    return `
      Company: ${company.companyName}
      Contact: ${company.contactPersonName}${company.contactPersonTitle ? ` (${company.contactPersonTitle})` : ''}
      Phone: ${company.phone}
      Email: ${company.email}
      ${company.websiteUrl ? `Website: ${company.websiteUrl}` : ''}
    `;
  } catch (error) {
    console.warn('[GeminiService] Failed to load company details:', error);
    return '';
  }
};

/**
 * Gets relevant products for AI context
 */
const getRelevantProducts = async (context: string): Promise<Product[]> => {
  try {
    const { ProductCatalogService } = await import('./productCatalogService');
    const allProducts = await ProductCatalogService.getProducts();
    
    // Simple keyword matching - in production, could use AI to find relevant products
    const keywords = context.toLowerCase().split(/\s+/);
    return allProducts.filter(product => {
      const searchText = `${product.name} ${product.category} ${product.shortDescription} ${product.fullDescription} ${product.tags.join(' ')}`.toLowerCase();
      return keywords.some(keyword => searchText.includes(keyword));
    }).slice(0, 5); // Limit to 5 most relevant
  } catch (error) {
    console.warn('[GeminiService] Failed to load products:', error);
    return [];
  }
};

/**
 * Builds comprehensive product context for AI analysis
 */
const buildProductContext = async (importer: Importer, products: Product[]): Promise<string> => {
  try {
    const { ProductRecommendationService } = await import('./productRecommendationService');
    const { ProductPriceStrategy } = await import('./productPriceStrategy');
    
    // Get recommendations based on customer data
    const recommendations = await ProductRecommendationService.getRecommendationsForCustomer(
      importer.id,
      { 
        previousPurchases: typeof importer.productsImported === 'string' 
          ? [importer.productsImported] 
          : (Array.isArray(importer.productsImported) ? importer.productsImported : []),
        customerCategory: importer.category,
        location: importer.country,
      }
    );
    
    // Build comprehensive context for AI analysis
    let context = `
Customer Analysis Data:
- Name: ${importer.name}
- Contact: ${importer.contactDetail}
- Business Category: ${importer.category || 'Not specified'}
- What They Deal In: ${typeof importer.productsImported === 'string' ? importer.productsImported : (Array.isArray(importer.productsImported) ? importer.productsImported.join(', ') : 'Not specified')}
- Previous Purchases: ${typeof importer.productsImported === 'string' ? importer.productsImported : (Array.isArray(importer.productsImported) ? importer.productsImported.join(', ') : 'None')}
- Location: ${importer.country || 'Not specified'}
- Company: ${importer.companyName || 'Not specified'}
`;

    if (importer.chatHistory && importer.chatHistory.length > 0) {
      context += `- Recent Chat History: ${JSON.stringify(importer.chatHistory.slice(-5).map(m => ({ role: m.role, content: m.content.substring(0, 100) })))}\n`;
    }

    context += `
Available Products:
${products.map(p => {
  const priceContext = p.referencePrice 
    ? `${p.referencePriceCurrency || 'USD'} ${p.referencePrice}/${p.unit} (FOR YOUR REFERENCE ONLY - DO NOT QUOTE THIS PRICE)`
    : 'Price on request';
  
  return `
  - ${p.name} (${p.category}): ${p.shortDescription}
    Full Description: ${p.fullDescription}
    Unit: ${p.unit}
    Reference Price Context: ${priceContext}
    ${p.photos.length > 0 ? `Primary Photo: ${p.photos.find(ph => ph.isPrimary)?.url || p.photos[0].url}` : ''}
    Tags: ${p.tags.join(', ')}
    ${p.specifications ? `Specifications: ${JSON.stringify(p.specifications)}` : ''}
  `;
}).join('\n')}

AI Recommendations for this customer:
${recommendations.map(r => `- ${r.productName} (Reason: ${r.reason}, Confidence: ${r.confidence}%): ${r.context || ''}`).join('\n')}

${ProductPriceStrategy.PRICE_STRATEGY_INSTRUCTIONS}

AI Instructions:
1. Analyze what this customer deals in based on their purchase history, business category, and products imported
2. Generate a personalized message that matches their business needs and industry
3. Reference relevant products based on what they deal in and their business type
4. NEVER quote final prices - use reference prices only for context
5. Always request quantity for quotation
6. Use natural, conversational language appropriate for their business
7. Include product photos when relevant
8. Make the message feel custom-written and tailored to their specific business, not templated
9. Show understanding of their industry and what they deal in
`;

    return context;
  } catch (error) {
    console.warn('[GeminiService] Failed to build product context:', error);
    return '';
  }
};

/**
 * Gets product pricing for AI context
 */
const getProductPricing = async (productId: string, tier?: string): Promise<number | null> => {
  try {
    const { ProductPricingService } = await import('./productPricingService');
    return await ProductPricingService.getPriceForProduct(productId, tier as any);
  } catch (error) {
    console.warn('[GeminiService] Failed to load pricing:', error);
    return null;
  }
};

/**
 * Generates the initial introductory message based on a customizable template.
 * Adapts format based on target channel (Email vs Chat).
 * Now enhanced with lead research for deeper personalization.
 * Automatically loads company and product data from services.
 */
export const generateIntroMessage = async (
  importer: Importer, 
  myCompany: string | null = null, 
  myProduct: string | null = null,
  template: string,
  targetChannel: Channel,
  useResearch: boolean = true,
  options: { timeout?: number } = {}
): Promise<string> => {
  
  if (!checkRateLimit()) {
    return "Error: Rate limit exceeded. Please wait a moment.";
  }

  // Load company details if not provided
  let companyName = myCompany;
  let companyContext = '';
  if (!companyName) {
    companyContext = await getCompanyContext();
    const company = await (await import('./companyConfigService')).CompanyConfigService.getCompanyDetails();
    companyName = company?.companyName || 'Our Company';
  } else {
    companyContext = await getCompanyContext();
  }

  // Get relevant products
  const relevantProducts = await getRelevantProducts(importer.productsImported);
  const productList = relevantProducts.length > 0
    ? relevantProducts.map(p => `- ${p.name} (${p.category}): ${p.shortDescription}`).join('\n')
    : myProduct || 'Our products';

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
    myProduct: productList,
    myCompany: companyName
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
    
    // Set up timeout (default: 10s for real-time operations)
    const timeout = options.timeout ?? parseInt(process.env.AI_REALTIME_TIMEOUT || '10000', 10);
    let timeoutId: NodeJS.Timeout | null = null;
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
      });
      
      if (timeoutId) clearTimeout(timeoutId);
      
      const responseTime = Date.now() - startTime;
      await recordApiUsage(keyId, true, responseTime);
      
      const result = response.text || "Error generating message.";
      
      // Cache the response
      await aiResponseCache.cacheResponse(prompt, result, {
        function: 'generateIntroMessage',
        targetChannel,
        importerId: importer.id,
      });
      
      return result;
    } catch (requestError: any) {
      if (timeoutId) clearTimeout(timeoutId);
      
      if (abortController.signal.aborted) {
        throw new Error(`Request timed out after ${timeout}ms`);
      }
      throw requestError;
    }
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // Record failed usage
    try {
      const bestKey = await selectBestKey(ApiKeyProvider.GEMINI);
      const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
      const errorMessage = error?.error || error?.message || error?.details?.detail || String(error);
      await recordApiUsage(keyId, false, undefined, errorMessage);
    } catch (trackError) {
      // Ignore tracking errors
    }
    
    // Handle structured API errors
    if (error?.error === 'ERROR_BAD_REQUEST' || error?.details?.title?.includes('Bad request')) {
      const detail = error?.details?.detail || error?.details?.title || 'Invalid request';
      return `Error: ${detail}. Please check your API key and request parameters.`;
    }
    
    const errorMessage = error?.message || error?.error || error?.details?.detail || 'Unknown error';
    return `Could not generate intro message: ${errorMessage}. Please check your API key and configuration.`;
  }
};

/**
 * Generates a context-aware reply to the importer using custom instructions and retained context.
 * Uses cross-channel history to maintain continuity.
 * Automatically loads company and product data from services.
 */
export const generateAgentReply = async (
  importer: Importer, 
  history: Message[], 
  myCompany: string | null = null, 
  systemInstructionTemplate: string,
  targetChannel: Channel,
  options: { timeout?: number } = {}
): Promise<string> => {
  
  if (!checkRateLimit()) {
    return "Error: Rate limit exceeded. Please wait a moment.";
  }

  // Load company details if not provided
  let companyName = myCompany;
  if (!companyName) {
    const company = await (await import('./companyConfigService')).CompanyConfigService.getCompanyDetails();
    companyName = company?.companyName || 'Our Company';
  }

  // Get relevant products for context
  const relevantProducts = await getRelevantProducts(importer.productsImported || '');
  
  // Build comprehensive product context with recommendations and price strategy
  const productContext = await buildProductContext(importer, relevantProducts);

  // Include Channel in history for context awareness
  const conversation = history.map(m => `[${m.channel}] ${m.sender.toUpperCase()}: ${m.content}`).join('\n');
  
  // Context Retention: Explicitly feed back the AI's own previous understanding
  const contextBlock = `
    Context Summary: ${importer.conversationSummary || 'Starting conversation.'}
    Identified Interest: ${importer.interestShownIn || 'Not yet identified.'}
    Next Goal: ${importer.nextStep || 'Qualify lead.'}
    ${productContext}
  `;

  const filledInstruction = replacePlaceholders(systemInstructionTemplate, {
    myCompany: companyName
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
    
    // Set up timeout (default: 10s for real-time operations)
    const timeout = options.timeout ?? parseInt(process.env.AI_REALTIME_TIMEOUT || '10000', 10);
    let timeoutId: NodeJS.Timeout | null = null;
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
      });
      
      if (timeoutId) clearTimeout(timeoutId);
      
      const responseTime = Date.now() - startTime;
      await recordApiUsage(keyId, true, responseTime);
      
      const result = response.text || "Error generating reply.";
      
      // Cache the response (use compressed prompt for cache key)
      await aiResponseCache.cacheResponse(compressedPrompt, result, {
        function: 'generateAgentReply',
        targetChannel,
        importerId: importer.id,
      });
      
      return result;
    } catch (requestError: any) {
      if (timeoutId) clearTimeout(timeoutId);
      
      if (abortController.signal.aborted) {
        throw new Error(`Request timed out after ${timeout}ms`);
      }
      throw requestError;
    }
  } catch (error: any) {
    console.error("Gemini API Reply Error:", error);
    
    try {
      const bestKey = await selectBestKey(ApiKeyProvider.GEMINI);
      const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
      const errorMessage = error?.error || error?.message || error?.details?.detail || String(error);
      await recordApiUsage(keyId, false, undefined, errorMessage);
    } catch (trackError) {
      // Ignore tracking errors
    }
    
    // Handle structured API errors
    if (error?.error === 'ERROR_BAD_REQUEST' || error?.details?.title?.includes('Bad request')) {
      const detail = error?.details?.detail || error?.details?.title || 'Invalid request';
      return `Error: ${detail}. Please check your API key and request parameters.`;
    }
    
    const errorMessage = error?.message || error?.error || error?.details?.detail || 'Unknown error';
    return `System Error: ${errorMessage}. Please check your API key and configuration.`;
  }
};

/**
 * Generates an email message for initial outreach to a lead
 * Formats the message as HTML email with proper subject line
 */
export const generateEmailMessage = async (
  importer: Importer,
  myCompany: string | null = null,
  myProduct: string | null = null,
  template: string,
  useResearch: boolean = true
): Promise<{ subject: string; body: string }> => {
  
  if (!checkRateLimit()) {
    return {
      subject: 'Re: Your Inquiry',
      body: 'Error: Rate limit exceeded. Please wait a moment.',
    };
  }

  // Generate intro message using existing logic
  const introContent = await generateIntroMessage(
    importer,
    myCompany,
    myProduct,
    template,
    Channel.EMAIL,
    useResearch
  );

  // Generate subject line
  const subjectPrompt = `
    Generate a professional email subject line for this message:
    ${introContent.substring(0, 200)}
    
    Requirements:
    - Professional and concise (under 60 characters)
    - Relevant to the lead's business/industry
    - Include company name if appropriate
    - Avoid spam trigger words
    
    Output ONLY the subject line, no quotes or extra text.
  `;

  try {
    const client = await getAiClient();
    const startTime = Date.now();
    
    const bestKey = await selectBestKey(ApiKeyProvider.GEMINI, { priority: 'reliability' });
    const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
    
    const subjectResponse = await client.models.generateContent({
      model: MODEL_NAME,
      contents: subjectPrompt,
    });
    
    const responseTime = Date.now() - startTime;
    await recordApiUsage(keyId, true, responseTime);
    
    const subject = (subjectResponse.text || `Re: ${importer.companyName || importer.name} - Inquiry`).trim();
    
    // Format body as HTML
    const htmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          ${introContent.split('\n').map(line => `<p>${line}</p>`).join('\n')}
        </body>
      </html>
    `;
    
    return {
      subject,
      body: htmlBody,
    };
  } catch (error: any) {
    console.error('[GeminiService] Email message generation error:', error);
    
    try {
      const bestKey = await selectBestKey(ApiKeyProvider.GEMINI);
      const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
      const errorMessage = error?.error || error?.message || error?.details?.detail || String(error);
      await recordApiUsage(keyId, false, undefined, errorMessage);
    } catch (trackError) {
      // Ignore tracking errors
    }
    
    // Fallback
    return {
      subject: `Re: ${importer.companyName || importer.name} - Inquiry`,
      body: introContent,
    };
  }
};

/**
 * Generates an email reply based on incoming email and conversation history
 * Maintains email thread context and professional formatting
 */
export const generateEmailReply = async (
  importer: Importer,
  incomingEmailBody: string,
  incomingEmailSubject: string
): Promise<string> => {
  
  if (!checkRateLimit()) {
    return 'Error: Rate limit exceeded. Please wait a moment.';
  }

  // Load company details
  const company = await (await import('./companyConfigService')).CompanyConfigService.getCompanyDetails();
  const companyName = company?.companyName || 'Our Company';
  const companyContext = await getCompanyContext();

  // Get relevant products
  const relevantProducts = await getRelevantProducts(importer.productsImported || '');
  const productContext = await buildProductContext(importer, relevantProducts);

  // Get conversation history (filter to email messages for context)
  const emailHistory = importer.chatHistory
    .filter(m => m.channel === Channel.EMAIL)
    .slice(-10); // Last 10 email messages
  
  const conversation = emailHistory.map(m => 
    `${m.sender === 'importer' ? 'Customer' : 'You'}: ${m.content}`
  ).join('\n\n');

  // Build context
  const contextBlock = `
    Context Summary: ${importer.conversationSummary || 'Starting conversation.'}
    Identified Interest: ${importer.interestShownIn || 'Not yet identified.'}
    Next Goal: ${importer.nextStep || 'Qualify lead.'}
    ${productContext}
  `;

  const prompt = `
    You are a professional sales representative for ${companyName}.
    
    ${companyContext}
    
    You are replying to an email from a potential customer (lead).
    
    Customer Details:
    Name: ${importer.name} (${importer.companyName}, ${importer.country})
    Imports: ${importer.productsImported}
    
    ${contextBlock}
    
    Incoming Email:
    Subject: ${incomingEmailSubject}
    Body: ${incomingEmailBody}
    
    Previous Email Conversation:
    ${conversation || 'This is the first email in the conversation.'}
    
    Instructions:
    - Write a professional, helpful email reply
    - Address their questions and concerns directly
    - Maintain a friendly but professional tone
    - Keep it concise but complete (150-300 words)
    - If they ask for pricing, provide a general range or ask for quantity/Incoterms
    - Always end with a question or next step to keep the conversation moving
    - Format as HTML email (use <p> tags for paragraphs)
    - Do NOT include email headers (To, From, Subject) - just the body content
    
    Output ONLY the email body content in HTML format.
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
    
    let replyBody = response.text || 'Thank you for your email. We will get back to you shortly.';
    
    // Ensure it's properly formatted HTML
    if (!replyBody.includes('<p>') && !replyBody.includes('<html>')) {
      replyBody = `<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">${replyBody.split('\n').map(line => line.trim() ? `<p>${line}</p>` : '').join('\n')}</body></html>`;
    }
    
    return replyBody;
  } catch (error: any) {
    console.error('[GeminiService] Email reply generation error:', error);
    
    try {
      const bestKey = await selectBestKey(ApiKeyProvider.GEMINI);
      const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
      const errorMessage = error?.error || error?.message || error?.details?.detail || String(error);
      await recordApiUsage(keyId, false, undefined, errorMessage);
    } catch (trackError) {
      // Ignore tracking errors
    }
    
    // Handle structured API errors
    if (error?.error === 'ERROR_BAD_REQUEST' || error?.details?.title?.includes('Bad request')) {
      const detail = error?.details?.detail || error?.details?.title || 'Invalid request';
      return `<p>Error: ${detail}. Please check your API key and request parameters.</p>`;
    }
    
    // Fallback reply
    return `<html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;"><p>Thank you for your email. We appreciate your interest and will respond to your inquiry shortly.</p><p>Best regards,<br>${companyName}</p></body></html>`;
  }
};

/**
 * Analyzes the conversation to determine lead status, extract details, detect escalation needs, and score the lead.
 */
export const analyzeLeadQuality = async (history: Message[], options: { timeout?: number } = {}): Promise<AnalysisResult> => {
  
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
    // Compress prompt and history
    const { compressPrompt, compressHistory } = await import('../server/utils/promptCompression');
    const compressedHistory = compressHistory(history);
    const compressedConversation = compressedHistory.map(m => `[${m.channel}] ${m.sender.toUpperCase()}: ${m.content}`).join('\n');
    const compressedPrompt = compressPrompt(prompt.replace(conversation, compressedConversation));

    // Check cache first
    const aiResponseCache = await import('../server/services/aiResponseCache');
    const cached = await aiResponseCache.getCachedResponse(compressedPrompt);
    if (cached && cached.response) {
      console.log('[GeminiService] Using cached response for analyzeLeadQuality');
      return cached.response as AnalysisResult;
    }

    const client = await getAiClient();
    const startTime = Date.now();
    
    const bestKey = await selectBestKey(ApiKeyProvider.GEMINI, { priority: 'reliability' });
    const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
    
    // Set up timeout (default: 30s for background operations)
    const timeout = options.timeout ?? parseInt(process.env.AI_BACKGROUND_TIMEOUT || '30000', 10);
    let timeoutId: NodeJS.Timeout | null = null;
    const abortController = new AbortController();
    
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);
    }
    
    try {
      const response = await client.models.generateContent({
        model: MODEL_NAME,
        contents: compressedPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        }
      });
      
      if (timeoutId) clearTimeout(timeoutId);
      
      const responseTime = Date.now() - startTime;
      await recordApiUsage(keyId, true, responseTime);
      
      const jsonText = response.text || "{}";
      const result = JSON.parse(jsonText) as AnalysisResult;
      
      // Cache the response (use compressed prompt for cache key)
      await aiResponseCache.cacheResponse(compressedPrompt, result, {
        function: 'analyzeLeadQuality',
        historyLength: compressedHistory.length,
      });
      
      return result;
    } catch (requestError: any) {
      if (timeoutId) clearTimeout(timeoutId);
      
      if (abortController.signal.aborted) {
        throw new Error(`Request timed out after ${timeout}ms`);
      }
      throw requestError;
    }
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    
    try {
      const bestKey = await selectBestKey(ApiKeyProvider.GEMINI);
      const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
      const errorMessage = error?.error || error?.message || error?.details?.detail || String(error);
      await recordApiUsage(keyId, false, undefined, errorMessage);
    } catch (trackError) {
      // Ignore tracking errors
    }
    
    // Log structured error details if available
    if (error?.error === 'ERROR_BAD_REQUEST' || error?.details) {
      console.error("Structured API Error:", {
        error: error.error,
        details: error.details,
        isRetryable: error.isRetryable,
        isExpected: error.isExpected
      });
    }
    
    return {
      status: LeadStatus.ENGAGED,
      summary: error?.details?.detail || error?.error || "Analysis failed",
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
          const errorMessage = error?.error || error?.message || error?.details?.detail || String(error);
          await recordApiUsage(keyId, false, undefined, errorMessage);
        } catch (trackError) {
          // Ignore tracking errors
        }
        
        // Handle structured API errors
        if (error?.error === 'ERROR_BAD_REQUEST' || error?.details) {
          const detail = error?.details?.detail || error?.details?.title || error?.error || 'Invalid request';
          throw new Error(`API Error: ${detail}. Please check your API key and request parameters.`);
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
      const errorMessage = error?.error || error?.message || error?.details?.detail || String(error);
      await recordApiUsage(keyId, false, undefined, errorMessage);
    } catch (trackError) {
      // Ignore tracking errors
    }
    
    // Log structured error details if available
    if (error?.error === 'ERROR_BAD_REQUEST' || error?.details) {
      console.error("Structured API Error:", {
        error: error.error,
        details: error.details,
        isRetryable: error.isRetryable,
        isExpected: error.isExpected
      });
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
      const errorMessage = error?.error || error?.message || error?.details?.detail || String(error);
      await recordApiUsage(keyId, false, undefined, errorMessage);
    } catch (trackError) {
      // Ignore tracking errors
    }
    
    // Handle structured API errors
    if (error?.error === 'ERROR_BAD_REQUEST' || error?.details) {
      console.warn("API Error in simulation:", error?.details?.detail || error?.error);
    }
    
    return "Interested, please send details.";
  }
};

export const generateCampaignMessage = async (
  importer: Importer, 
  myCompany: string | null = null, 
  myProduct: string | null = null,
  stepTemplate: string,
  targetChannel: Channel
): Promise<string> => {
   // Reuse intro generator logic but for campaigns (which use same template engine)
   // Now automatically loads company/product data from services
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
          const errorMessage = error?.error || error?.message || error?.details?.detail || String(error);
          await recordApiUsage(keyId, false, undefined, errorMessage);
        } catch (trackError) {
          // Ignore tracking errors
        }
        
        // Log structured error details if available
        if (error?.error === 'ERROR_BAD_REQUEST' || error?.details) {
          console.error("Structured API Error:", {
            error: error.error,
            details: error.details,
            isRetryable: error.isRetryable,
            isExpected: error.isExpected
          });
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
/**
 * Streaming version of generateAgentReply - returns async generator for incremental text chunks
 */
export async function* generateAgentReplyStream(
  importer: Importer,
  history: Message[],
  myCompany: string | null = null,
  systemInstructionTemplate: string,
  targetChannel: Channel,
  options: { timeout?: number } = {}
): AsyncGenerator<string, void, unknown> {
  if (!checkRateLimit()) {
    yield "Error: Rate limit exceeded. Please wait a moment.";
    return;
  }

  // Load company details if not provided
  let companyName = myCompany;
  if (!companyName) {
    const company = await (await import('./companyConfigService')).CompanyConfigService.getCompanyDetails();
    companyName = company?.companyName || 'Our Company';
  }

  // Get relevant products for context
  const relevantProducts = await getRelevantProducts(importer.productsImported || '');
  const productContext = await buildProductContext(importer, relevantProducts);

  // Include Channel in history for context awareness
  const conversation = history.map(m => `[${m.channel}] ${m.sender.toUpperCase()}: ${m.content}`).join('\n');
  
  // Context Retention: Explicitly feed back the AI's own previous understanding
  const contextBlock = `
    Context Summary: ${importer.conversationSummary || 'Starting conversation.'}
    Identified Interest: ${importer.interestShownIn || 'Not yet identified.'}
    Next Goal: ${importer.nextStep || 'Qualify lead.'}
    ${productContext}
  `;

  const filledInstruction = replacePlaceholders(systemInstructionTemplate, {
    myCompany: companyName
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
    
    // Set up timeout (default: 10s for real-time operations)
    const timeout = options.timeout ?? parseInt(process.env.AI_REALTIME_TIMEOUT || '10000', 10);
    let timeoutId: NodeJS.Timeout | null = null;
    const abortController = new AbortController();
    
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);
    }

    try {
      // Use streaming API
      const stream = await client.models.generateContentStream({
        model: MODEL_NAME,
        contents: prompt,
      });

      if (timeoutId) clearTimeout(timeoutId);

      // Stream chunks as they arrive
      for await (const chunk of stream) {
        const text = chunk.text || '';
        if (text) {
          yield text;
        }
      }

      const responseTime = Date.now() - startTime;
      await recordApiUsage(keyId, true, responseTime);
    } catch (requestError: any) {
      if (timeoutId) clearTimeout(timeoutId);
      
      if (abortController.signal.aborted) {
        throw new Error(`Request timed out after ${timeout}ms`);
      }
      throw requestError;
    }
  } catch (error: any) {
    console.error("Gemini API Streaming Error:", error);
    
    try {
      const bestKey = await selectBestKey(ApiKeyProvider.GEMINI);
      const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
      const errorMessage = error?.error || error?.message || error?.details?.detail || String(error);
      await recordApiUsage(keyId, false, undefined, errorMessage);
    } catch (trackError) {
      // Ignore tracking errors
    }
    
    yield `Error: ${error?.message || error?.error || 'Failed to generate reply'}`;
  }
}

/**
 * Streaming version of generateIntroMessage - returns async generator for incremental text chunks
 */
export async function* generateIntroMessageStream(
  importer: Importer,
  myCompany: string | null = null,
  myProduct: string | null = null,
  template: string,
  targetChannel: Channel,
  useResearch: boolean = true,
  options: { timeout?: number } = {}
): AsyncGenerator<string, void, unknown> {
  if (!checkRateLimit()) {
    yield "Error: Rate limit exceeded. Please wait a moment.";
    return;
  }

  // Load company details if not provided
  let companyName = myCompany;
  let companyContext = '';
  if (!companyName) {
    companyContext = await getCompanyContext();
    const company = await (await import('./companyConfigService')).CompanyConfigService.getCompanyDetails();
    companyName = company?.companyName || 'Our Company';
  } else {
    companyContext = await getCompanyContext();
  }

  // Get relevant products
  const relevantProducts = await getRelevantProducts(importer.productsImported);
  const productList = relevantProducts.length > 0
    ? relevantProducts.map(p => `- ${p.name} (${p.category}): ${p.shortDescription}`).join('\n')
    : myProduct || 'Our products';

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
    productCategory: importer.productsImported,
    myProduct: productList,
    myCompany: companyName
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
    
    const bestKey = await selectBestKey(ApiKeyProvider.GEMINI, { priority: 'reliability' });
    const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
    
    // Set up timeout (default: 10s for real-time operations)
    const timeout = options.timeout ?? parseInt(process.env.AI_REALTIME_TIMEOUT || '10000', 10);
    let timeoutId: NodeJS.Timeout | null = null;
    const abortController = new AbortController();
    
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);
    }

    try {
      // Use streaming API
      const stream = await client.models.generateContentStream({
        model: MODEL_NAME,
        contents: prompt,
      });

      if (timeoutId) clearTimeout(timeoutId);

      // Stream chunks as they arrive
      for await (const chunk of stream) {
        const text = chunk.text || '';
        if (text) {
          yield text;
        }
      }

      const responseTime = Date.now() - startTime;
      await recordApiUsage(keyId, true, responseTime);
    } catch (requestError: any) {
      if (timeoutId) clearTimeout(timeoutId);
      
      if (abortController.signal.aborted) {
        throw new Error(`Request timed out after ${timeout}ms`);
      }
      throw requestError;
    }
  } catch (error: any) {
    console.error("Gemini API Streaming Error:", error);
    
    try {
      const bestKey = await selectBestKey(ApiKeyProvider.GEMINI);
      const keyId = bestKey?.id || (await getPrimaryKey(ApiKeyProvider.GEMINI))?.id || 'unknown';
      const errorMessage = error?.error || error?.message || error?.details?.detail || String(error);
      await recordApiUsage(keyId, false, undefined, errorMessage);
    } catch (trackError) {
      // Ignore tracking errors
    }
    
    yield `Error: ${error?.message || error?.error || 'Failed to generate intro message'}`;
  }
}

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
      const errorMessage = error?.error || error?.message || error?.details?.detail || String(error);
      await recordApiUsage(keyId, false, undefined, errorMessage);
    } catch (trackError) {
      // Ignore tracking errors
    }
    
    // Log structured error details if available
    if (error?.error === 'ERROR_BAD_REQUEST' || error?.details) {
      console.error("Structured API Error:", {
        error: error.error,
        details: error.details,
        isRetryable: error.isRetryable,
        isExpected: error.isExpected
      });
    }
    
    // Fallback
    return [];
  }
};
