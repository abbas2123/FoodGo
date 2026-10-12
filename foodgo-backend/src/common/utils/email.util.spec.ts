import { describe, it, expect } from 'vitest';
import { EmailUtil } from './email.util.js';

describe('EmailUtil', () => {
  describe('normalize', () => {
    it('trims leading and trailing whitespace', () => {
      expect(EmailUtil.normalize('  user@example.com  ')).toBe('user@example.com');
    });

    it('converts uppercase characters to lowercase', () => {
      expect(EmailUtil.normalize('USER.Name+tag@EXAMPLE.COM')).toBe('user.name+tag@example.com');
    });

    it('returns empty string for null or undefined or empty', () => {
      expect(EmailUtil.normalize('')).toBe('');
      expect(EmailUtil.normalize(null as any)).toBe('');
      expect(EmailUtil.normalize(undefined as any)).toBe('');
    });
  });

  describe('isValid', () => {
    it('accepts valid email formats', () => {
      expect(EmailUtil.isValid('user@example.com')).toBe(true);
      expect(EmailUtil.isValid('first.last@domain.co.uk')).toBe(true);
      expect(EmailUtil.isValid('customer+tag@sub.domain.org')).toBe(true);
      expect(EmailUtil.isValid('user_123@domain.io')).toBe(true);
    });

    it('rejects invalid email formats', () => {
      expect(EmailUtil.isValid('')).toBe(false);
      expect(EmailUtil.isValid('plainaddress')).toBe(false);
      expect(EmailUtil.isValid('@missingusername.com')).toBe(false);
      expect(EmailUtil.isValid('username@.com')).toBe(false);
      expect(EmailUtil.isValid('user@domain')).toBe(false);
      expect(EmailUtil.isValid('user@domain..com')).toBe(false);
      expect(EmailUtil.isValid('user name@domain.com')).toBe(false);
    });

    it('rejects emails exceeding 255 characters', () => {
      const longLocal = 'a'.repeat(250);
      expect(EmailUtil.isValid(`${longLocal}@example.com`)).toBe(false);
    });
  });

  describe('mask', () => {
    it('masks standard email addresses safely', () => {
      expect(EmailUtil.mask('customer@example.com')).toBe('cu*****@example.com');
      expect(EmailUtil.mask('alice@foodigo.app')).toBe('al***@foodigo.app');
    });

    it('handles short local parts', () => {
      expect(EmailUtil.mask('ab@example.com')).toBe('a*@example.com');
      expect(EmailUtil.mask('a@example.com')).toBe('a*@example.com');
    });

    it('returns fallback for invalid email structure', () => {
      expect(EmailUtil.mask('invalid')).toBe('****');
      expect(EmailUtil.mask('')).toBe('****');
    });
  });
});
