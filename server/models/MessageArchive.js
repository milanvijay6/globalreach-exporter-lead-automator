/**
 * Message Archive Model
 * Archive class for old messages
 * Keeps main Message table lean by moving old data here
 */

const Parse = require('parse/node');

const MessageArchive = Parse.Object.extend('MessageArchive');

module.exports = MessageArchive;

