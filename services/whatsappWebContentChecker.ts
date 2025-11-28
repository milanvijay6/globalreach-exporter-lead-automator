/**
 * WhatsApp Web Content Checker
 * Ensures message uniqueness and prevents spam-like content
 */

interface ContentCheckResult {
  valid: boolean;
  uniquenessScore: number; // 0-100
  reasons: string[];
  suggestions?: string[];
}

interface RecentMessage {
  hash: string;
  timestamp: number;
  content: string;
}

class WhatsAppWebContentCheckerClass {
  private recentMessages: RecentMessage[] = [];
  private readonly MAX_RECENT_MESSAGES = 50;
  private readonly MIN_UNIQUENESS_SCORE = 70;
  private readonly MESSAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Spam keywords that should be avoided
  private readonly SPAM_KEYWORDS = [
    'free', 'click here', 'limited time', 'act now', 'buy now',
    'urgent', 'guaranteed', 'no risk', 'winner', 'congratulations',
    'cash prize', 'claim now', 'exclusive offer', 'one time only',
    'don\'t miss out', 'last chance', 'limited offer', 'special promotion',
    'discount', 'sale', 'promo', 'deal', 'offer expires',
  ];

  // Promotional patterns
  private readonly PROMOTIONAL_PATTERNS = [
    /\d+% (off|discount|sale)/i,
    /(buy|purchase|order) (now|today|immediately)/i,
    /(limited|exclusive) (offer|deal|promotion)/i,
    /(act|hurry|rush) (now|today|immediately)/i,
  ];

  /**
   * Check if message content is valid and unique
   */
  checkContent(content: string, recipientContext?: {
    name?: string;
    previousMessages?: string[];
  }): ContentCheckResult {
    const reasons: string[] = [];
    const suggestions: string[] = [];
    let uniquenessScore = 100;

    // Clean and normalize content
    const normalizedContent = this.normalizeContent(content);
    const contentHash = this.hashContent(normalizedContent);

    // Check for duplicate content
    const duplicateCheck = this.checkDuplicates(contentHash, normalizedContent);
    if (!duplicateCheck.unique) {
      uniquenessScore -= 50;
      reasons.push(`Duplicate content detected (similar to message sent ${duplicateCheck.timeAgo})`);
      suggestions.push('Modify the message to make it unique');
    }

    // Check for spam keywords
    const spamCheck = this.checkSpamKeywords(normalizedContent);
    if (spamCheck.hasSpam) {
      uniquenessScore -= 20;
      reasons.push(`Contains spam keywords: ${spamCheck.keywords.join(', ')}`);
      suggestions.push('Remove or replace promotional language');
    }

    // Check for promotional patterns
    const patternCheck = this.checkPromotionalPatterns(normalizedContent);
    if (patternCheck.hasPatterns) {
      uniquenessScore -= 15;
      reasons.push('Contains promotional patterns that may trigger spam filters');
      suggestions.push('Use more natural, conversational language');
    }

    // Check personalization
    const personalizationCheck = this.checkPersonalization(normalizedContent, recipientContext);
    if (!personalizationCheck.isPersonalized) {
      uniquenessScore -= 10;
      reasons.push('Message lacks personalization');
      suggestions.push('Include recipient name or context-specific information');
    }

    // Check message length (too short might be spam-like)
    if (content.trim().length < 20) {
      uniquenessScore -= 5;
      reasons.push('Message is too short (may appear spam-like)');
      suggestions.push('Add more context and detail to the message');
    }

    // Check for template-like patterns
    const templateCheck = this.checkTemplatePatterns(normalizedContent);
    if (templateCheck.isTemplate) {
      uniquenessScore -= 10;
      reasons.push('Message appears to be a template (lacks natural variation)');
      suggestions.push('Vary sentence structure and wording');
    }

    // Check context awareness
    if (recipientContext?.previousMessages && recipientContext.previousMessages.length > 0) {
      const contextCheck = this.checkContextAwareness(normalizedContent, recipientContext.previousMessages);
      if (!contextCheck.isContextual) {
        uniquenessScore -= 5;
        reasons.push('Message doesn\'t reference previous conversation');
        suggestions.push('Reference previous messages or conversation history');
      }
    }

    // Ensure uniqueness score doesn't go below 0
    uniquenessScore = Math.max(0, uniquenessScore);

    const valid = uniquenessScore >= this.MIN_UNIQUENESS_SCORE && reasons.length === 0;

    return {
      valid,
      uniquenessScore,
      reasons,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }

  /**
   * Record a sent message for duplicate checking
   */
  recordMessage(content: string): void {
    const normalizedContent = this.normalizeContent(content);
    const contentHash = this.hashContent(normalizedContent);

    // Add to recent messages
    this.recentMessages.push({
      hash: contentHash,
      timestamp: Date.now(),
      content: normalizedContent,
    });

    // Clean old messages
    this.cleanOldMessages();

    // Keep only recent messages
    if (this.recentMessages.length > this.MAX_RECENT_MESSAGES) {
      this.recentMessages = this.recentMessages.slice(-this.MAX_RECENT_MESSAGES);
    }
  }

  /**
   * Get similarity score between two messages (0-100, higher = more similar)
   */
  getSimilarityScore(content1: string, content2: string): number {
    const normalized1 = this.normalizeContent(content1);
    const normalized2 = this.normalizeContent(content2);

    // Simple word-based similarity
    const words1 = new Set(normalized1.split(/\s+/));
    const words2 = new Set(normalized2.split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    if (union.size === 0) return 0;

    const jaccardSimilarity = (intersection.size / union.size) * 100;
    return Math.round(jaccardSimilarity);
  }

  private checkDuplicates(contentHash: string, normalizedContent: string): {
    unique: boolean;
    timeAgo?: string;
  } {
    const now = Date.now();

    for (const msg of this.recentMessages) {
      // Check exact hash match
      if (msg.hash === contentHash) {
        const timeAgo = this.formatTimeAgo(now - msg.timestamp);
        return { unique: false, timeAgo };
      }

      // Check similarity (if very similar, consider duplicate)
      const similarity = this.getSimilarityScore(normalizedContent, msg.content);
      if (similarity > 90) {
        const timeAgo = this.formatTimeAgo(now - msg.timestamp);
        return { unique: false, timeAgo };
      }
    }

    return { unique: true };
  }

  private checkSpamKeywords(content: string): {
    hasSpam: boolean;
    keywords: string[];
  } {
    const contentLower = content.toLowerCase();
    const foundKeywords: string[] = [];

    for (const keyword of this.SPAM_KEYWORDS) {
      if (contentLower.includes(keyword.toLowerCase())) {
        foundKeywords.push(keyword);
      }
    }

    return {
      hasSpam: foundKeywords.length > 0,
      keywords: foundKeywords,
    };
  }

  private checkPromotionalPatterns(content: string): {
    hasPatterns: boolean;
  } {
    for (const pattern of this.PROMOTIONAL_PATTERNS) {
      if (pattern.test(content)) {
        return { hasPatterns: true };
      }
    }

    return { hasPatterns: false };
  }

  private checkPersonalization(content: string, recipientContext?: {
    name?: string;
    previousMessages?: string[];
  }): {
    isPersonalized: boolean;
  } {
    // Check if recipient name is included
    if (recipientContext?.name) {
      const nameLower = recipientContext.name.toLowerCase();
      const contentLower = content.toLowerCase();
      if (contentLower.includes(nameLower)) {
        return { isPersonalized: true };
      }
    }

    // Check for context-specific references
    if (recipientContext?.previousMessages && recipientContext.previousMessages.length > 0) {
      // If message references previous conversation, it's personalized
      const hasContextReference = recipientContext.previousMessages.some(prevMsg => {
        const prevWords = prevMsg.toLowerCase().split(/\s+/).filter(w => w.length > 4);
        return prevWords.some(word => content.toLowerCase().includes(word));
      });

      if (hasContextReference) {
        return { isPersonalized: true };
      }
    }

    // Check for generic placeholders (indicates lack of personalization)
    const hasPlaceholders = /\{\{|\}\}|\[name\]|\[company\]/i.test(content);
    if (hasPlaceholders) {
      return { isPersonalized: false };
    }

    // Default: consider personalized if it's not obviously a template
    return { isPersonalized: true };
  }

  private checkTemplatePatterns(content: string): {
    isTemplate: boolean;
  } {
    // Check for common template patterns
    const templateIndicators = [
      /^Hello\s+(there|everyone|all)/i,
      /^Dear\s+(Sir|Madam|Customer)/i,
      /^(We|I)\s+hope\s+this\s+email/i,
      /^(Please|Kindly)\s+(find|see|note)/i,
      /^(Thank\s+you|Thanks)\s+(for|in advance)/i,
    ];

    for (const pattern of templateIndicators) {
      if (pattern.test(content)) {
        // Check if it's followed by generic content
        const isGeneric = content.split(/\n/).length < 3 && content.length < 200;
        if (isGeneric) {
          return { isTemplate: true };
        }
      }
    }

    return { isTemplate: false };
  }

  private checkContextAwareness(content: string, previousMessages: string[]): {
    isContextual: boolean;
  } {
    // Extract key terms from previous messages
    const previousTerms = new Set<string>();
    for (const msg of previousMessages) {
      const words = msg.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      words.forEach(word => previousTerms.add(word));
    }

    // Check if current message references any previous terms
    const contentLower = content.toLowerCase();
    const hasReference = Array.from(previousTerms).some(term => contentLower.includes(term));

    return { isContextual: hasReference };
  }

  private normalizeContent(content: string): string {
    return content
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  private hashContent(content: string): string {
    // Use Web Crypto API if available (browser), otherwise simple hash
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      // For browser, use a simple hash (Web Crypto API is async, so we use fallback)
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash).toString(16);
    }
    
    // Fallback: simple hash
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private cleanOldMessages(): void {
    const now = Date.now();
    this.recentMessages = this.recentMessages.filter(
      msg => now - msg.timestamp < this.MESSAGE_TTL_MS
    );
  }

  private formatTimeAgo(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
  }
}

// Singleton instance
let contentCheckerInstance: WhatsAppWebContentCheckerClass | null = null;

export const WhatsAppWebContentChecker = {
  /**
   * Get or create content checker instance
   */
  getInstance: (): WhatsAppWebContentCheckerClass => {
    if (!contentCheckerInstance) {
      contentCheckerInstance = new WhatsAppWebContentCheckerClass();
    }
    return contentCheckerInstance;
  },

  /**
   * Reset instance (for testing)
   */
  resetInstance: (): void => {
    contentCheckerInstance = null;
  },
};

export type { ContentCheckResult };

