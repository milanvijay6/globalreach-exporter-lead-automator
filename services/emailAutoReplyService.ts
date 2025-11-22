
import { EmailMessage, EmailClassification } from './emailClassificationService';
import { EmailSendingService } from './emailSendingService';
import { generateAgentReply } from './geminiService';
import { Importer, AppTemplates, Channel, Message } from '../types';

export interface AutoReplyOptions {
  requireApproval?: boolean; // Supervised mode
  escalationKeywords?: string[];
  maxAutoRepliesPerDay?: number;
  cooldownMinutes?: number;
}

const DEFAULT_OPTIONS: AutoReplyOptions = {
  requireApproval: false,
  escalationKeywords: ['manager', 'human', 'help', 'complaint', 'urgent', 'problem', 'cancel', 'refund'],
  maxAutoRepliesPerDay: 10,
  cooldownMinutes: 5,
};

// Track auto-reply history
const autoReplyHistory: Map<string, { count: number; lastReply: number }> = new Map();

/**
 * Email Auto-Reply Service
 * Handles AI-powered automated email replies
 */
export const EmailAutoReplyService = {
  /**
   * Determines if an email should trigger an auto-reply
   */
  shouldAutoReply: (
    message: EmailMessage,
    classification: EmailClassification,
    options: AutoReplyOptions = DEFAULT_OPTIONS
  ): { shouldReply: boolean; reason?: string } => {
    // Don't reply to spam or irrelevant
    if (classification.category === 'spam' || classification.category === 'irrelevant') {
      return { shouldReply: false, reason: 'Spam or irrelevant email' };
    }

    // Don't reply to out-of-office
    if (classification.category === 'out_of_office') {
      return { shouldReply: false, reason: 'Out-of-office message' };
    }

    // Check escalation keywords
    const content = `${message.subject} ${message.body.text || ''}`.toLowerCase();
    const hasEscalationKeyword = options.escalationKeywords?.some(keyword =>
      content.includes(keyword.toLowerCase())
    );

    if (hasEscalationKeyword || classification.requiresHumanReview) {
      return { shouldReply: false, reason: 'Requires human review' };
    }

    // Check rate limiting
    const senderKey = message.from.email.toLowerCase();
    const history = autoReplyHistory.get(senderKey);
    const now = Date.now();

    if (history) {
      // Check daily limit
      const dayStart = new Date().setHours(0, 0, 0, 0);
      if (history.lastReply < dayStart) {
        // New day, reset count
        history.count = 0;
      }

      if (history.count >= (options.maxAutoRepliesPerDay || 10)) {
        return { shouldReply: false, reason: 'Daily auto-reply limit reached' };
      }

      // Check cooldown
      const cooldownMs = (options.cooldownMinutes || 5) * 60 * 1000;
      if (now - history.lastReply < cooldownMs) {
        return { shouldReply: false, reason: 'Cooldown period active' };
      }
    }

    return { shouldReply: true };
  },

  /**
   * Generates an AI-powered reply
   */
  generateReply: async (
    message: EmailMessage,
    classification: EmailClassification,
    importer: Importer,
    templates: AppTemplates,
    conversationHistory: Message[] = []
  ): Promise<{ reply: string; subject: string }> => {
    // Convert email to message format for geminiService
    const emailAsMessage: Message = {
      id: message.id,
      sender: 'importer',
      content: message.body.text || message.body.html?.replace(/<[^>]*>/g, '') || '',
      timestamp: message.date.getTime(),
      channel: Channel.EMAIL,
    };

    const fullHistory = [...conversationHistory, emailAsMessage];

    // Generate reply using existing geminiService
    const replyContent = await generateAgentReply(
      importer,
      fullHistory,
      'Global Exports',
      templates.agentSystemInstruction,
      Channel.EMAIL
    );

    // Generate subject (reply to original or new)
    const subject = message.subject.startsWith('Re:') || message.subject.startsWith('RE:')
      ? message.subject
      : `Re: ${message.subject}`;

    return {
      reply: replyContent,
      subject,
    };
  },

  /**
   * Sends an auto-reply email
   */
  sendAutoReply: async (
    message: EmailMessage,
    classification: EmailClassification,
    importer: Importer,
    templates: AppTemplates,
    conversationHistory: Message[],
    options: AutoReplyOptions = DEFAULT_OPTIONS
  ): Promise<{ success: boolean; messageId?: string; error?: string; requiresApproval?: boolean }> => {
    try {
      // Check if should auto-reply
      const shouldReply = EmailAutoReplyService.shouldAutoReply(message, classification, options);
      if (!shouldReply.shouldReply) {
        return { success: false, error: shouldReply.reason };
      }

      // Generate reply
      const { reply, subject } = await EmailAutoReplyService.generateReply(
        message,
        classification,
        importer,
        templates,
        conversationHistory
      );

      // If supervised mode, return for approval
      if (options.requireApproval) {
        return {
          success: false,
          requiresApproval: true,
          error: 'Reply generated, awaiting approval',
        };
      }

      // Send reply
      const result = await EmailSendingService.sendEmail(
        importer,
        reply,
        templates,
        {
          subject,
          useHTML: true,
          inReplyTo: message.id,
          references: message.references ? [...message.references, message.id] : [message.id],
        }
      );

      if (result.success) {
        // Update history
        const senderKey = message.from.email.toLowerCase();
        const history = autoReplyHistory.get(senderKey) || { count: 0, lastReply: 0 };
        history.count++;
        history.lastReply = Date.now();
        autoReplyHistory.set(senderKey, history);
      }

      return result;
    } catch (error: any) {
      console.error('[EmailAutoReply] Send error:', error);
      return { success: false, error: error.message || 'Failed to send auto-reply' };
    }
  },

  /**
   * Gets reply preview for approval
   */
  getReplyPreview: async (
    message: EmailMessage,
    classification: EmailClassification,
    importer: Importer,
    templates: AppTemplates,
    conversationHistory: Message[]
  ): Promise<{ reply: string; subject: string }> => {
    return EmailAutoReplyService.generateReply(
      message,
      classification,
      importer,
      templates,
      conversationHistory
    );
  },

  /**
   * Sends a thank-you message (triggered on inquiry)
   */
  sendThankYouMessage: async (
    importer: Importer,
    templates: AppTemplates
  ): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    const thankYouTemplate = `
Hello {{importerName}},

Thank you for your inquiry about {{productCategory}}.

We have received your message and our team will review it shortly. We typically respond within 24 hours.

In the meantime, feel free to browse our product catalog or contact us if you have any urgent questions.

Best regards,
{{myCompany}}
    `.trim();

    return EmailSendingService.sendEmail(
      importer,
      thankYouTemplate,
      templates,
      {
        subject: 'Thank you for your inquiry',
        useHTML: true,
      }
    );
  },

  /**
   * Clears auto-reply history (for testing or reset)
   */
  clearHistory: () => {
    autoReplyHistory.clear();
  },
};

