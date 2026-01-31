## 2026-01-31 - Unverified WhatsApp Webhook
**Vulnerability:** The WhatsApp webhook endpoint (`POST /webhooks/whatsapp`) was accepting payloads without verifying the `X-Hub-Signature-256` header, allowing attackers to inject fake messages or leads.
**Learning:** Webhook endpoints that trigger business logic (like updating leads) must verify the sender's identity. Relying on obscure URLs or "security through obscurity" is insufficient.
**Prevention:** Always implement HMAC signature verification for all webhooks. Ensure `express.json` is configured to capture the raw body (`verify` callback) to enable signature verification.
