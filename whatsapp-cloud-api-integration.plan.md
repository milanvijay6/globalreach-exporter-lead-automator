# WhatsApp Cloud API Integration Setup

## Overview
Implement comprehensive WhatsApp Cloud API integration for GlobalReach application. This includes setting up Meta (Facebook) Business account, creating WhatsApp Business App, configuring webhooks, and integrating with the existing messaging infrastructure.

## Implementation Steps

### Step 1: Create Meta Business Account Documentation

**File**: `WHATSAPP_CLOUD_API_SETUP.md` (new file)
- Create comprehensive step-by-step guide:
  - Create/verify Meta Business Account at business.facebook.com
  - Create Meta App in Meta for Developers (developers.facebook.com)
  - Add WhatsApp Product to the app
  - Set up WhatsApp Business Account (free or paid)
  - Document how to get:
    - Access Token (Temporary or System User Token)
    - Phone Number ID
    - Business Account ID
    - App ID and App Secret
    - Webhook Verify Token (custom secret)
  - Configure webhook URL (http://localhost:PORT/webhooks/whatsapp)
  - Subscribe to webhook fields (messages, message_status)
  - Test webhook verification
  - Include screenshots placeholders and troubleshooting section
  - Note about free vs paid tier limitations

### Step 2: Enhance WhatsApp Credentials Configuration UI

**File**: `components/PlatformConnectModal.tsx`
- Improve WhatsApp connection modal:
  - Add clearer field labels and descriptions
  - Add help tooltips explaining where to find each credential
  - Add "Test Connection" button before connecting
  - Show connection status after testing
  - Add link to setup guide
  - Add validation for phone number ID format (numeric)
  - Add validation for access token format
- Add webhook URL display and copy button (similar to email OAuth redirect URI)
- Show webhook verification token field with auto-generation option
- Add "Generate Random Token" button for webhook verify token

### Step 3: Add WhatsApp Configuration to Settings

**File**: `components/SettingsModal.tsx`
- Add WhatsApp configuration section in Integrations tab:
  - Display current WhatsApp connection status
  - Show phone number ID, business account ID
  - Display webhook URL (with copy button)
  - Allow updating webhook verify token
  - Show last webhook received timestamp
  - Add "Test Webhook" button (sends test webhook from Meta)
  - Add "Reconnect" or "Update Credentials" option
  - Show API rate limit status if available

### Step 4: Enhance WhatsApp Service with Additional Features

**File**: `services/whatsappService.ts`
- Add missing functionality:
  - Send media messages (images, documents, videos, audio)
  - Send interactive messages (buttons, lists)
  - Mark messages as read
  - Get media URL from media ID
  - Download media from WhatsApp
  - Handle location messages
  - Handle contact messages
  - Better error handling with retry logic
  - Rate limit detection and handling
- Add message template management:
  - List available templates
  - Check template approval status
  - Validate template parameters before sending
- Add connection health check:
  - Periodic token validation
  - Check phone number status
  - Verify webhook connectivity

### Step 5: Improve Webhook Handling in Main Process

**File**: `electron/main.js`
- Enhance webhook endpoint:
  - Better webhook verification
  - Log all incoming webhooks for debugging
  - Handle multiple webhook types:
    - Incoming messages (text, media, location, contacts)
    - Message status updates (sent, delivered, read, failed)
    - Account status updates
  - Add webhook signature verification (if available)
  - Rate limiting protection
  - Better error responses
- Add webhook test endpoint for manual testing
- Add webhook log viewer endpoint

### Step 6: Add Webhook Status Monitoring

**File**: `components/SettingsModal.tsx` or new component
- Add webhook status dashboard:
  - Last webhook received timestamp
  - Webhook success/failure rate
  - Recent webhook logs (last 10-20)
  - Webhook errors/alerts
  - Webhook response time statistics
- Add webhook test tool:
  - Manual webhook trigger
  - Simulate incoming message
  - Test webhook verification

### Step 7: Add WhatsApp Template Management UI

**File**: `components/WhatsAppTemplateManager.tsx` (new file)
- Create template management component:
  - List all approved templates
  - Show template status (pending, approved, rejected)
  - Preview template format
  - Show template parameters
  - Test template sending (to own number)
  - Create new template request (link to Meta)
- Integrate into Settings or separate Templates tab

### Step 8: Add WhatsApp Message Status Tracking

**File**: `services/whatsappService.ts` and `components/ChatInterface.tsx`
- Enhance status tracking:
  - Track message delivery status in real-time
  - Show read receipts
  - Display failed message reasons
  - Retry failed messages
  - Show message timestamps
- Update UI to show message status indicators:
  - Sent (single checkmark)
  - Delivered (double checkmark)
  - Read (double blue checkmark)
  - Failed (error icon)

### Step 9: Add WhatsApp Business Account Info Display

**File**: `components/SettingsModal.tsx`
- Add WhatsApp account information section:
  - Display phone number (formatted)
  - Show business account name
  - Display account verification status
  - Show current tier (free vs paid)
  - Display rate limits:
    - Free tier: 1,000 conversations/month
    - Paid tier: variable based on plan
  - Show current usage statistics:
    - Messages sent this month
    - Conversations started
    - Available quota remaining
- Add account upgrade link (if on free tier)

### Step 10: Add Advanced Error Handling and Recovery

**File**: `services/whatsappService.ts`
- Implement comprehensive error handling:
  - Token expiration detection and refresh flow
  - Rate limit detection with automatic backoff
  - Network timeout handling with retries
  - Invalid phone number detection
  - Message too long handling (auto-split)
  - Unsupported media type handling
  - Account restriction detection
- Add error recovery mechanisms:
  - Automatic retry with exponential backoff
  - Queue failed messages for retry
  - Notify user of critical errors
  - Suggest fixes for common errors

### Step 11: Add WhatsApp Webhook Logging Service

**File**: `services/webhookLogService.ts` (new file)
- Create webhook logging service:
  - Store all incoming webhooks with timestamp
  - Store webhook processing results
  - Store errors and exceptions
  - Query webhooks by date range
  - Query webhooks by type (message, status)
  - Export webhook logs for debugging
- Integrate with existing logger service

### Step 12: Create Quick Reference Guide

**File**: `WHATSAPP_QUICK_REFERENCE.md` (new file)
- Create one-page quick reference:
  - Meta Business setup URL
  - Required credentials checklist
  - Webhook URL format
  - Common error codes and solutions
  - Rate limits reference
  - API endpoint URLs
  - Where to find each credential in Meta dashboard

## Technical Details

### Required Credentials Structure

```typescript
interface WhatsAppCredentials {
  phoneNumberId: string;        // WhatsApp Business Phone Number ID
  accessToken: string;          // Permanent or System User Access Token
  businessAccountId: string;    // WhatsApp Business Account ID (optional)
  webhookVerifyToken: string;   // Custom token for webhook verification
}
```

### Webhook URL Format

```
http://localhost:{PORT}/webhooks/whatsapp
```

Or with tunnel:
```
https://{tunnel-url}/webhooks/whatsapp
```

### Required Webhook Fields

- `messages` - Incoming messages from users
- `message_status` - Status updates for sent messages

### API Endpoints Used

- Send Message: `POST https://graph.facebook.com/v21.0/{phone-number-id}/messages`
- Get Phone Number: `GET https://graph.facebook.com/v21.0/{phone-number-id}?fields=display_phone_number,verified_name`
- Get Templates: `GET https://graph.facebook.com/v21.0/{business-account-id}/message_templates`

### Rate Limits

**Free Tier:**
- 1,000 conversations/month
- 24-hour messaging window per conversation
- Limited to template messages for initial contact

**Paid Tier:**
- Unlimited conversations (based on plan)
- Conversation-based pricing
- Can send free-form messages within 24-hour window

## Error Handling

### Common Errors and Solutions

1. **401 Unauthorized**
   - Token expired or invalid
   - Solution: Generate new access token

2. **404 Not Found**
   - Phone Number ID incorrect
   - Solution: Verify Phone Number ID in Meta dashboard

3. **429 Rate Limit Exceeded**
   - Too many messages sent
   - Solution: Implement rate limiting, wait before retry

4. **1000 Conversations Limit Reached**
   - Free tier limit exceeded
   - Solution: Upgrade to paid tier or wait for next month

5. **Invalid Phone Number**
   - Phone number format incorrect
   - Solution: Format as E.164 (country code + number, no + sign)

## Files to Create

1. `WHATSAPP_CLOUD_API_SETUP.md` - Comprehensive setup guide
2. `WHATSAPP_QUICK_REFERENCE.md` - Quick reference card
3. `components/WhatsAppTemplateManager.tsx` - Template management UI
4. `services/webhookLogService.ts` - Webhook logging service

## Files to Modify

1. `components/PlatformConnectModal.tsx` - Enhance WhatsApp connection UI
2. `components/SettingsModal.tsx` - Add WhatsApp configuration section
3. `services/whatsappService.ts` - Add advanced features and error handling
4. `electron/main.js` - Enhance webhook handling
5. `components/ChatInterface.tsx` - Add message status indicators
6. `types.ts` - Add any missing WhatsApp-related types

## Security Considerations

1. **Access Token Storage**
   - Store access tokens securely (encrypted)
   - Never log access tokens
   - Support token rotation

2. **Webhook Verification**
   - Always verify webhook verify token
   - Validate webhook signature (if implemented by Meta)
   - Rate limit webhook endpoint

3. **Phone Number Privacy**
   - Don't expose phone numbers in logs
   - Encrypt phone numbers in database
   - Implement access controls

## Testing Checklist

- [ ] Test connection with valid credentials
- [ ] Test connection with invalid credentials
- [ ] Test sending text message
- [ ] Test sending template message
- [ ] Test receiving incoming message webhook
- [ ] Test message status webhook updates
- [ ] Test webhook verification
- [ ] Test rate limit handling
- [ ] Test error recovery
- [ ] Test media message sending
- [ ] Test webhook with invalid signature
- [ ] Test token expiration handling

## Future Enhancements

1. **Multi-Number Support**
   - Support multiple WhatsApp Business numbers
   - Route messages based on number availability
   - Load balancing across numbers

2. **Advanced Messaging Features**
   - Interactive buttons and lists
   - Rich media (carousel, products)
   - Location sharing
   - Contact sharing

3. **Analytics Dashboard**
   - Message delivery rates
   - Response times
   - Conversation analytics
   - Cost tracking

4. **Automated Template Approval Workflow**
   - Template submission automation
   - Status monitoring
   - Approval notifications

