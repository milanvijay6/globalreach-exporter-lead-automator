
import type { EmailMessage } from './emailTypes';
import { analyzeLeadQuality, AnalysisResult } from './geminiService';
import { LeadStatus, SentimentData, EmotionData } from '../types';

export interface EmailClassification {
  category: 'lead_inquiry' | 'support_request' | 'spam' | 'irrelevant' | 'internal' | 'out_of_office';
  intent: 'purchase' | 'inquiry' | 'complaint' | 'support' | 'other';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  leadScore: number; // 0-100
  topics: string[];
  extractedData: {
    companyName?: string;
    contactPerson?: string;
    phoneNumbers?: string[];
    productInterests?: string[];
    quantities?: string;
    requirements?: string;
    budgetIndicators?: string;
    timeline?: string;
  };
  sentiment: SentimentData;
  emotions: EmotionData[];
  requiresHumanReview: boolean;
}

/**
 * Email Classification Service
 * Uses AI to classify and extract data from emails
 */
export const EmailClassificationService = {
  /**
   * Classifies an email using AI
   */
  classifyEmail: async (message: EmailMessage): Promise<EmailClassification> => {
    try {
      const { GoogleGenAI, Type } = await import('@google/genai');
      const apiKey = process.env.API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });
      const MODEL_NAME = 'gemini-2.5-flash';

      // Prepare email content for analysis
      const emailContent = `
From: ${message.from.name || ''} <${message.from.email}>
Subject: ${message.subject}
Body: ${message.body.text || message.body.html?.replace(/<[^>]*>/g, '') || ''}
      `.trim();

      const classificationSchema = {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            enum: ['lead_inquiry', 'support_request', 'spam', 'irrelevant', 'internal', 'out_of_office'],
            description: 'Primary classification category'
          },
          intent: {
            type: Type.STRING,
            enum: ['purchase', 'inquiry', 'complaint', 'support', 'other'],
            description: 'Intent of the email'
          },
          urgency: {
            type: Type.STRING,
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Urgency level'
          },
          leadScore: {
            type: Type.INTEGER,
            description: 'Lead score 0-100 (buying likelihood)'
          },
          topics: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Key topics/products mentioned'
          },
          extractedData: {
            type: Type.OBJECT,
            properties: {
              companyName: { type: Type.STRING },
              contactPerson: { type: Type.STRING },
              phoneNumbers: { type: Type.ARRAY, items: { type: Type.STRING } },
              productInterests: { type: Type.ARRAY, items: { type: Type.STRING } },
              quantities: { type: Type.STRING },
              requirements: { type: Type.STRING },
              budgetIndicators: { type: Type.STRING },
              timeline: { type: Type.STRING }
            }
          },
          sentiment: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING, enum: ['Positive', 'Neutral', 'Negative', 'Critical'] },
              score: { type: Type.NUMBER },
              intensity: { type: Type.NUMBER }
            },
            required: ['label', 'score', 'intensity']
          },
          emotions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING, enum: ['Frustration', 'Confusion', 'Enthusiasm', 'Urgency', 'Skepticism', 'Gratitude'] },
                confidence: { type: Type.NUMBER }
              },
              required: ['label', 'confidence']
            }
          },
          requiresHumanReview: { type: Type.BOOLEAN }
        },
        required: ['category', 'intent', 'urgency', 'leadScore', 'topics', 'extractedData', 'sentiment', 'emotions', 'requiresHumanReview']
      };

      const prompt = `
Analyze this email and classify it according to the schema.

Email:
${emailContent}

Tasks:
1. Classify the email category (lead_inquiry, support_request, spam, irrelevant, internal, out_of_office)
2. Determine intent (purchase, inquiry, complaint, support, other)
3. Assess urgency (low, medium, high, critical)
4. Calculate lead score (0-100) based on buying signals
5. Extract key topics and products mentioned
6. Extract structured data (company, contact, phone, products, quantities, requirements, budget, timeline)
7. Analyze sentiment and emotions
8. Determine if human review is needed (high urgency, complaint, critical sentiment, or unclear intent)

Focus on identifying sales opportunities and lead quality.
      `;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: classificationSchema,
        }
      });

      const jsonText = response.text || '{}';
      const classification = JSON.parse(jsonText) as EmailClassification;

      return classification;
    } catch (error) {
      console.error('[EmailClassification] Classification error:', error);
      
      // Fallback classification
      return {
        category: 'irrelevant',
        intent: 'other',
        urgency: 'low',
        leadScore: 0,
        topics: [],
        extractedData: {},
        sentiment: { label: 'Neutral', score: 0, intensity: 0 },
        emotions: [],
        requiresHumanReview: true, // Require review on error
      };
    }
  },

  /**
   * Quick spam detection (before full AI classification)
   */
  isLikelySpam: (message: EmailMessage): boolean => {
    const spamIndicators = [
      /(viagra|cialis|poker|casino|lottery|winner|prize|free money)/i,
      /(click here|limited time|act now|urgent response required)/i,
      /(nigerian prince|inheritance|unclaimed funds)/i,
    ];

    const content = `${message.subject} ${message.body.text || ''}`.toLowerCase();
    
    // Check for spam indicators
    const spamScore = spamIndicators.filter(regex => regex.test(content)).length;
    
    // Check sender domain reputation (basic)
    const senderDomain = message.from.email.split('@')[1]?.toLowerCase();
    const suspiciousDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com'];
    const isSuspiciousDomain = suspiciousDomains.some(domain => senderDomain?.includes(domain));

    return spamScore >= 2 || isSuspiciousDomain;
  },

  /**
   * Extracts phone numbers from email content
   */
  extractPhoneNumbers: (content: string): string[] => {
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const matches = content.match(phoneRegex) || [];
    return matches.map(phone => phone.trim());
  },

  /**
   * Maps classification to lead status
   */
  classificationToLeadStatus: (classification: EmailClassification): LeadStatus => {
    if (classification.category === 'spam' || classification.category === 'irrelevant') {
      return LeadStatus.COLD;
    }
    if (classification.category === 'lead_inquiry') {
      if (classification.leadScore >= 70) {
        return LeadStatus.INTERESTED;
      } else if (classification.leadScore >= 40) {
        return LeadStatus.ENGAGED;
      } else {
        return LeadStatus.CONTACTED;
      }
    }
    if (classification.category === 'support_request') {
      return LeadStatus.ENGAGED;
    }
    return LeadStatus.PENDING;
  },
};

