/**
 * MessagePack Client
 * Handles MessagePack encoding/decoding for API requests
 */

// Note: msgpackr doesn't have browser support by default
// For browser, we'll use a polyfill or handle it server-side only
// This is a placeholder for future browser MessagePack support

/**
 * Check if MessagePack is supported
 */
export function isMsgpackSupported(): boolean {
  // For now, MessagePack is server-side only
  // Browser support would require a different library
  return false;
}

/**
 * Encode data to MessagePack (server-side only)
 */
export function encodeMsgpack(data: any): ArrayBuffer | null {
  // This would be used server-side
  // Browser implementation would require a different approach
  return null;
}

/**
 * Decode MessagePack data
 */
export async function decodeMsgpack(buffer: ArrayBuffer | Uint8Array): Promise<any> {
  // For browser, we'd need to use a MessagePack library that works in browsers
  // For now, this is a placeholder
  // In practice, the server would handle MessagePack and the client would
  // request it via Accept header, then decode the response
  
  // If we receive MessagePack, we'd decode it here
  // For now, return null to indicate it's not supported
  return null;
}

/**
 * Create fetch options with MessagePack accept header
 */
export function getMsgpackFetchOptions(): RequestInit {
  return {
    headers: {
      'Accept': 'application/json, application/msgpack',
    },
  };
}

