import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

@Injectable()
export class CryptoService {
  private getKey(): Buffer {
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret || secret.length < 16) {
      throw new Error('请配置 ENCRYPTION_KEY 环境变量，至少 16 字符');
    }
    return crypto.createHash('sha256').update(secret).digest();
  }

  encrypt(plainText: string): string {
    if (!plainText) return '';
    try {
      const key = this.getKey();
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
      let encrypted = cipher.update(plainText, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (e) {
      console.error('[Crypto] 加密失败:', e);
      throw e;
    }
  }

  decrypt(cipherText: string): string {
    if (!cipherText) return '';
    try {
      const parts = cipherText.split(':');
      if (parts.length !== 3) return cipherText; // 可能是旧版未加密数据
      const key = this.getKey();
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
      decipher.setAuthTag(authTag);
      return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
    } catch (e) {
      console.error('[Crypto] 解密失败:', e);
      return '';
    }
  }
}
