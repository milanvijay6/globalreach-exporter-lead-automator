
import { EmailSendingService } from './emailSendingService';
import { CampaignService } from './campaignService';
import { CalendarService } from './calendarService';
import { Importer, AppTemplates, Channel, Campaign, CalendarEvent, LeadStatus } from '../types';

export interface EmailWorkflowTrigger {
  type: 'email_opened' | 'link_clicked' | 'replied' | 'ignored' | 'time_elapsed';
  value?: any; // e.g., link URL for link_clicked, days for time_elapsed
}

export interface EmailWorkflowAction {
  type: 'send_email' | 'send_followup' | 'stop_sequence' | 'escalate' | 'mark_cold' | 'schedule_meeting' | 'update_status';
  config?: Record<string, any>;
}

export interface EmailWorkflow {
  id: string;
  name: string;
  triggers: EmailWorkflowTrigger[];
  actions: EmailWorkflowAction[];
  enabled: boolean;
}

/**
 * Email Workflow Service
 * Handles drip campaigns and trigger-based email automation
 */
export const EmailWorkflowService = {
  /**
   * Processes email workflows based on triggers
   */
  processTriggers: async (
    trigger: EmailWorkflowTrigger,
    importer: Importer,
    workflows: EmailWorkflow[],
    templates: AppTemplates
  ): Promise<{ executed: string[]; errors: string[] }> => {
    const executed: string[] = [];
    const errors: string[] = [];

    for (const workflow of workflows) {
      if (!workflow.enabled) continue;

      // Check if workflow matches trigger
      const matchesTrigger = workflow.triggers.some(t => 
        t.type === trigger.type && 
        (t.value === undefined || t.value === trigger.value)
      );

      if (matchesTrigger) {
        // Execute workflow actions
        for (const action of workflow.actions) {
          try {
            await EmailWorkflowService.executeAction(
              action,
              importer,
              templates,
              trigger
            );
            executed.push(`${workflow.name}: ${action.type}`);
          } catch (error: any) {
            errors.push(`${workflow.name}: ${error.message}`);
          }
        }
      }
    }

    return { executed, errors };
  },

  /**
   * Executes a workflow action
   */
  executeAction: async (
    action: EmailWorkflowAction,
    importer: Importer,
    templates: AppTemplates,
    trigger: EmailWorkflowTrigger
  ): Promise<void> => {
    switch (action.type) {
      case 'send_email':
        const emailTemplate = action.config?.template || templates.introTemplate;
        await EmailSendingService.sendEmail(
          importer,
          emailTemplate,
          templates,
          {
            subject: action.config?.subject || 'Follow-up from Global Exports',
            useHTML: true,
          }
        );
        break;

      case 'send_followup':
        const followupTemplate = action.config?.template || `
Hello {{importerName}},

Just following up on our previous conversation about {{productCategory}}.

Is there anything else you'd like to know? I'm here to help.

Best regards,
{{myCompany}}
        `.trim();
        await EmailSendingService.sendEmail(
          importer,
          followupTemplate,
          templates,
          {
            subject: `Re: ${action.config?.subject || 'Your inquiry'}`,
            useHTML: true,
          }
        );
        break;

      case 'stop_sequence':
        // Stop any active campaigns
        CampaignService.stopEnrollment(importer.id);
        break;

      case 'escalate':
        // Mark for human review
        importer.needsHumanReview = true;
        break;

      case 'mark_cold':
        // Update status to cold
        importer.status = LeadStatus.COLD;
        break;

      case 'schedule_meeting':
        const meetingEvent: CalendarEvent = {
          id: `meeting-${Date.now()}`,
          title: `Meeting with ${importer.name}`,
          start: Date.now() + (action.config?.daysOffset || 1) * 24 * 60 * 60 * 1000,
          end: Date.now() + (action.config?.daysOffset || 1) * 24 * 60 * 60 * 1000 + (action.config?.duration || 30) * 60 * 1000,
          importerId: importer.id,
          type: 'meeting',
          status: 'pending',
        };
        // CalendarService would handle adding this
        break;

      case 'update_status':
        const newStatus = action.config?.status as LeadStatus;
        if (newStatus) {
          importer.status = newStatus;
        }
        break;
    }
  },

  /**
   * Default email workflows
   */
  getDefaultWorkflows: (): EmailWorkflow[] => {
    return [
      {
        id: 'email-opened-followup',
        name: 'Follow-up on Email Open',
        triggers: [{ type: 'email_opened' }],
        actions: [
          { type: 'send_followup', config: { subject: 'Did you see our previous message?' } },
        ],
        enabled: false, // Disabled by default
      },
      {
        id: 'link-clicked-info',
        name: 'Send Info on Link Click',
        triggers: [{ type: 'link_clicked' }],
        actions: [
          { type: 'send_email', config: { subject: 'More Information', template: 'Detailed product information...' } },
        ],
        enabled: false,
      },
      {
        id: 'reply-stop-sequence',
        name: 'Stop Sequence on Reply',
        triggers: [{ type: 'replied' }],
        actions: [
          { type: 'stop_sequence' },
        ],
        enabled: true,
      },
      {
        id: 'ignored-escalate',
        name: 'Escalate Ignored Emails',
        triggers: [{ type: 'ignored', value: 7 }], // 7 days
        actions: [
          { type: 'escalate' },
          { type: 'send_email', config: { subject: 'Final Follow-up', template: 'Final attempt to connect...' } },
        ],
        enabled: false,
      },
      {
        id: 'time-elapsed-nurture',
        name: 'Nurture Sequence',
        triggers: [{ type: 'time_elapsed', value: 3 }], // 3 days
        actions: [
          { type: 'send_followup' },
        ],
        enabled: false,
      },
    ];
  },

  /**
   * Creates a drip campaign workflow
   */
  createDripCampaign: (
    name: string,
    steps: Array<{ dayOffset: number; template: string; subject: string }>
  ): EmailWorkflow => {
    return {
      id: `drip-${Date.now()}`,
      name,
      triggers: steps.map(step => ({
        type: 'time_elapsed' as const,
        value: step.dayOffset,
      })),
      actions: steps.map(step => ({
        type: 'send_email' as const,
        config: {
          template: step.template,
          subject: step.subject,
        },
      })),
      enabled: true,
    };
  },
};

