import crypto from 'crypto';

class EncryptionService {
    constructor(secretKey) {
        this.algorithm = 'aes-256-cbc';
        // Use a fixed key derived from a secret (e.g., from env vars) for consistent decryption
        // Ensure the key is 32 bytes for aes-256-cbc
        this.key = crypto.createHash('sha256').update(String(secretKey || process.env.ENCRYPTION_KEY || 'default-encryption-key')).digest('base64').substr(0, 32);
        // IV should ideally be unique per encryption, but stored alongside the ciphertext
        // For simplicity here, using a fixed IV derived from the key, but this is less secure.
        // A better approach stores a unique IV per encrypted value.
        this.iv = crypto.createHash('sha256').update(String(this.key)).digest('base64').substr(0, 16);
    }

    encrypt(text) {
        try {
            const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.key), Buffer.from(this.iv));
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            // In a real application, you might return IV + encrypted data
            // return this.iv.toString('hex') + ':' + encrypted;
            return encrypted;
        } catch (error) {
            console.error("Encryption failed:", error);
            throw new Error("Encryption failed");
        }
    }

    decrypt(encrypted) {
        try {
            // If storing IV with data:
            // const parts = encrypted.split(':');
            // const iv = Buffer.from(parts.shift(), 'hex');
            // const encryptedText = parts.join(':');
            // const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(this.key), iv);

            // Using fixed IV (less secure):
            const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(this.key), Buffer.from(this.iv));
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            console.error("Decryption failed:", error);
            // Avoid leaking specific crypto errors to the client
            throw new Error("Decryption failed or invalid data");
        }
    }
}

// Export a single instance or the class itself depending on usage needs
// export default new EncryptionService(); // Singleton instance
export default EncryptionService; // Export class
