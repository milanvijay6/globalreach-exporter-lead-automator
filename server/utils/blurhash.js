/**
 * Server-side BlurHash generation utility
 * Generates BlurHash for images uploaded to the server
 */

const sharp = require('sharp');
const { encode } = require('blurhash');

const COMPONENT_X = parseInt(process.env.BLURHASH_COMPONENTS || '4', 10);
const COMPONENT_Y = parseInt(process.env.BLURHASH_COMPONENTS || '4', 10);

/**
 * Generate BlurHash from image buffer
 * @param {Buffer} imageBuffer - Image file buffer
 * @returns {Promise<string>} BlurHash string
 */
async function generateBlurHash(imageBuffer) {
  try {
    // Resize image to small size for faster processing (max 32px)
    const { data, info } = await sharp(imageBuffer)
      .resize(32, 32, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Generate BlurHash
    const blurHash = encode(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
      COMPONENT_X,
      COMPONENT_Y
    );

    return blurHash;
  } catch (error) {
    console.error('[BlurHash] Error generating BlurHash:', error);
    return null;
  }
}

/**
 * Generate BlurHash from image file path
 * @param {string} imagePath - Path to image file
 * @returns {Promise<string>} BlurHash string
 */
async function generateBlurHashFromFile(imagePath) {
  try {
    const fs = require('fs');
    const imageBuffer = fs.readFileSync(imagePath);
    return await generateBlurHash(imageBuffer);
  } catch (error) {
    console.error('[BlurHash] Error generating BlurHash from file:', error);
    return null;
  }
}

module.exports = {
  generateBlurHash,
  generateBlurHashFromFile,
};

