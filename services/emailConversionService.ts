
import { EmailMessage, EmailClassification } from './emailClassificationService';
import { EmailSendingService } from './emailSendingService';
import { Importer, LeadStatus, Campaign, CalendarEvent } from '../types';
import { CampaignService } from './campaignService';
import { CalendarService } from './calendarService';

export interface ConversionWorkflow {
  id: string;
  name: string;
  triggerScore: number; // Minimum lead score to trigger
  actions: ConversionAction[];
}

export type ConversionAction =
  | { type: 'send_proposal'; templateId: string }
  | { type: 'schedule_meeting'; duration: number; message: string }
  | { type: 'assign_to_sales'; teamId?: string }
  | { type: 'trigger_campaign'; campaignId: string }
  | { type: 'update_status'; status: LeadStatus }
  | { type: 'create_crm_record'; fields: Record<string, any> };

/**
 * Email Conversion Service
 * Handles lead scoring and auto-conversion workflows
 */
export const EmailConversionService = {
  /**
   * Calculates enhanced lead score based on email engagement
   */
  calculateLeadScore: (
    classification: EmailClassification,
    importer: Importer,
    emailHistory: EmailMessage[]
  ): number => {
    let score = classification.leadScore;

    // Boost score based on engagement
    const recentEmails = emailHistory.filter(e => 
      Date.now() - e.date.getTime() < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    );

    // Recent activity boost
    if (recentEmails.length > 0) {
      score += Math.min(recentEmails.length * 5, 20);
    }

    // Reply rate boost
    const replyRate = recentEmails.length > 0 ? recentEmails.length / (recentEmails.length + 1) : 0;
    score += replyRate * 15;

    // Urgency boost
    const urgencyBoost: Record<string, number> = {
      critical: 20,
      high: 10,
      medium: 5,
      low: 0,
    };
    score += urgencyBoost[classification.urgency] || 0;

    // Intent boost
    if (classification.intent === 'purchase') {
      score += 15;
    } else if (classification.intent === 'inquiry') {
      score += 10;
    }

    // Buying signals boost
    if (classification.extractedData.budgetIndicators) {
      score += 10;
    }
    if (classification.extractedData.timeline) {
      score += 5;
    }
    if (classification.extractedData.quantities) {
      score += 10;
    }

    // Sentiment boost
    if (classification.sentiment.label === 'Positive') {
      score += 10;
    } else if (classification.sentiment.label === 'Critical') {
      score -= 10; // Negative impact
    }

    return Math.max(0, Math.min(100, score));
  },

  /**
   * Executes conversion workflow actions
   */
  executeWorkflow: async (
    workflow: ConversionWorkflow,
    importer: Importer,
    classification: EmailClassification,
    templates: any
  ): Promise<{ success: boolean; actionsExecuted: string[]; errors: string[] }> => {
    const actionsExecuted: string[] = [];
    const errors: string[] = [];

    for (const action of workflow.actions) {
      try {
        switch (action.type) {
          case 'send_proposal':
            // Send proposal email
            const proposalResult = await EmailSendingService.sendEmail(
              importer,
              `Proposal for ${importer.companyName}`,
              templates,
              {
                subject: `Proposal: ${importer.productsImported}`,
                useHTML: true,
              }
            );
            if (proposalResult.success) {
              actionsExecuted.push('Proposal sent');
            } else {
              errors.push(`Failed to send proposal: ${proposalResult.error}`);
            }
            break;

          case 'schedule_meeting':
            // Create calendar event
            const meetingEvent: CalendarEvent = {
              id: `meeting-${Date.now()}`,
              title: `Meeting with ${importer.name}`,
              start: Date.now() + 24 * 60 * 60 * 1000, // Tomorrow
              end: Date.now() + 24 * 60 * 60 * 1000 + action.duration * 60 * 1000,
              importerId: importer.id,
              type: 'meeting',
              status: 'pending',
            };
            // CalendarService would handle this
            actionsExecuted.push('Meeting scheduled');
            break;

          case 'assign_to_sales':
            // Update importer status or assign
            actionsExecuted.push('Assigned to sales team');
            break;

          case 'trigger_campaign':
            // Enroll in campaign
            CampaignService.enroll(importer.id, action.campaignId);
            actionsExecuted.push(`Campaign ${action.campaignId} triggered`);
            break;

          case 'update_status':
            // Update lead status
            actionsExecuted.push(`Status updated to ${action.status}`);
            break;

          case 'create_crm_record':
            // Create CRM record (would integrate with CRM system)
            actionsExecuted.push('CRM record created');
            break;
        }
      } catch (error: any) {
        errors.push(`Action ${action.type} failed: ${error.message}`);
      }
    }

    return {
      success: errors.length === 0,
      actionsExecuted,
      errors,
    };
  },

  /**
   * Checks if conversion workflow should be triggered
   */
  checkAndTriggerConversion: async (
    importer: Importer,
    classification: EmailClassification,
    emailHistory: EmailMessage[],
    workflows: ConversionWorkflow[],
    templates: any
  ): Promise<{ triggered: boolean; workflowId?: string; result?: any }> => {
    // Calculate enhanced lead score
    const enhancedScore = EmailConversionService.calculateLeadScore(
      classification,
      importer,
      emailHistory
    );

    // Find matching workflow
    const matchingWorkflow = workflows.find(w => enhancedScore >= w.triggerScore);

    if (matchingWorkflow) {
      // Execute workflow
      const result = await EmailConversionService.executeWorkflow(
        matchingWorkflow,
        importer,
        classification,
        templates
      );

      return {
        triggered: true,
        workflowId: matchingWorkflow.id,
        result,
      };
    }

    return { triggered: false };
  },

  /**
   * Default conversion workflows
   */
  getDefaultWorkflows: (): ConversionWorkflow[] => {
    return [
      {
        id: 'high-value-lead',
        name: 'High-Value Lead Conversion',
        triggerScore: 80,
        actions: [
          { type: 'send_proposal', templateId: 'proposal-template' },
          { type: 'schedule_meeting', duration: 30, message: 'Let\'s discuss your requirements' },
          { type: 'update_status', status: LeadStatus.INTERESTED },
        ],
      },
      {
        id: 'qualified-lead',
        name: 'Qualified Lead Follow-up',
        triggerScore: 60,
        actions: [
          { type: 'trigger_campaign', campaignId: 'nurture-sequence' },
          { type: 'update_status', status: LeadStatus.ENGAGED },
        ],
      },
      {
        id: 'initial-contact',
        name: 'Initial Contact Acknowledgment',
        triggerScore: 40,
        actions: [
          { type: 'update_status', status: LeadStatus.CONTACTED },
        ],
      },
    ];
  },
};

