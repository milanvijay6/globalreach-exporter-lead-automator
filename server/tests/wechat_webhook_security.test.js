const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

test('WeChat webhook security test - string validation', () => {
    // Check if the current implementation is vulnerable to type confusion
    const webhookToken = 'secret';

    // Attack scenario: passing an array for signature, timestamp, or nonce
    const req = {
        query: {
            signature: 'abc',
            timestamp: ['123', '456'], // Type confusion: passing an array instead of a string
            nonce: 'nonce123',
            echostr: 'echo'
        }
    };

    // Simulate current WeChat webhook GET handler logic
    const { signature, timestamp, nonce, echostr } = req.query;

    let isVulnerable = false;
    try {
        const tmpStr = [webhookToken, timestamp, nonce].sort().join('');
        const sha1 = crypto.createHash('sha1').update(tmpStr).digest('hex');
        isVulnerable = true;
    } catch (e) {
        // If it throws, it might be protected
    }

    assert.strictEqual(isVulnerable, true, "Logic should execute and might lead to unexpected results with arrays");
});

test('WeChat webhook security test - timing attack', () => {
    // Simulate timing attack vulnerability checking
    // Currently the code uses simple equality:
    // if (sha1 === signature)

    const sha1 = 'abcdef1234567890';
    const signature = 'abcdef1234567891';

    // Vulnerable pattern
    const isMatchVulnerable = sha1 === signature;

    // Secure pattern
    const isMatchSecure = signature && typeof signature === 'string' &&
                          sha1.length === signature.length &&
                          crypto.timingSafeEqual(Buffer.from(sha1), Buffer.from(signature));

    assert.strictEqual(isMatchVulnerable, false);
    assert.strictEqual(isMatchSecure, false);
});
