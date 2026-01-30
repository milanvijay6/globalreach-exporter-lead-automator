## 2024-05-22 - [Webhook Signature Verification Gap]
**Vulnerability:** The WhatsApp webhook endpoint (`POST /whatsapp`) accepted payloads without verifying the `X-Hub-Signature-256` header, allowing potential attackers to spoof messages.
**Learning:** Standard `express.json()` middleware consumes the request stream, making the raw body unavailable for HMAC verification. This is a common gap in Express.js apps handling webhooks.
**Prevention:** Configure `express.json()` with a `verify` callback to capture the raw buffer (e.g., `req.rawBody = buf`) globally or for specific routes requiring signature verification.
