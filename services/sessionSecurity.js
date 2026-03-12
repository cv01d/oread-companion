import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const KEY_FILE = path.join(os.homedir(), '.oread-chat-key');

class SessionSecurity {
  constructor() {
    this.encryptionKey = null;
  }

  // Initialize encryption key (machine-specific "pepper" strategy)
  async initialize() {
    try {
      // Try to load existing key
      const keyData = await fs.readFile(KEY_FILE, 'utf8');
      this.encryptionKey = Buffer.from(keyData, 'hex');
      console.log('✅ Loaded encryption key from', KEY_FILE);
    } catch (error) {
      // Generate new machine-specific key on first run
      if (error.code === 'ENOENT') {
        console.log('🔐 Generating machine-specific encryption key...');
        this.encryptionKey = crypto.randomBytes(32); // 256-bit key

        // Save to restricted file
        await fs.writeFile(KEY_FILE, this.encryptionKey.toString('hex'), {
          mode: 0o600 // Read/write for owner only
        });

        console.log('✅ Encryption key saved to', KEY_FILE);
        console.log('⚠️  Keep this file safe! Without it, encrypted data is unrecoverable.');
      } else {
        throw error;
      }
    }

    return this.encryptionKey;
  }

  // Generate cryptographically secure session IDs
  generateSecureSessionId() {
    return crypto.randomBytes(16).toString('hex'); // 32 char hex string
  }

  // Hash session ID for storage (prevents guessing)
  hashSessionId(sessionId) {
    return crypto.createHash('sha256').update(sessionId).digest('hex');
  }

  // Encrypt sensitive session data
  encryptSessionData(data) {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized. Call initialize() first.');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);

    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      iv: iv.toString('hex'),
      data: encrypted
    };
  }

  decryptSessionData(encrypted) {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized. Call initialize() first.');
    }

    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      this.encryptionKey,
      Buffer.from(encrypted.iv, 'hex')
    );

    let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  // Verify encrypted data integrity
  verifyIntegrity(encrypted, expectedHash) {
    const hash = crypto.createHash('sha256')
      .update(encrypted.data)
      .digest('hex');
    return hash === expectedHash;
  }
}

export default new SessionSecurity();
