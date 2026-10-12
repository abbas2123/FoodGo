import { describe, expect, it } from 'vitest';
import { OrderNumberUtil } from './order-number.util.js';

describe('OrderNumberUtil', () => {
  describe('generate', () => {
    it('should generate an order number with default FG- prefix and strictly 20 chars', () => {
      const orderNumber = OrderNumberUtil.generate();
      expect(orderNumber).toBeDefined();
      expect(typeof orderNumber).toBe('string');
      expect(orderNumber.startsWith('FG-')).toBe(true);
      expect(orderNumber.length).toBe(20);
    });

    it('should adhere to the fixed pattern FG-[0-9A-Z]{8}-[0-9A-F]{8} without truncation', () => {
      const orderNumber = OrderNumberUtil.generate();
      const pattern = /^FG-[0-9A-Z]{8}-[0-9A-F]{8}$/;
      expect(pattern.test(orderNumber)).toBe(true);

      // Verify the random part is exactly 8 hex characters (4 full random bytes)
      const parts = orderNumber.split('-');
      expect(parts.length).toBe(3);
      expect(parts[0]).toBe('FG');
      expect(parts[1].length).toBe(8); // 8-char Base36 timestamp
      expect(parts[2].length).toBe(8); // 8-char full random hex (not sliced or truncated)
    });

    it('should handle custom prefixes while maintaining fixed 20-character length', () => {
      const orderNumber = OrderNumberUtil.generate('OR');
      expect(orderNumber.startsWith('OR-')).toBe(true);
      expect(orderNumber.length).toBe(20);
      expect(/^OR-[0-9A-Z]{8}-[0-9A-F]{8}$/.test(orderNumber)).toBe(true);
    });

    it('should normalize long prefixes to preserve full 8-char random entropy and 20-char column limit', () => {
      const orderNumber = OrderNumberUtil.generate('ORDER');
      // Takes first 2 characters ('OR') so that timestamp (8) and random (8) remain completely untruncated
      expect(orderNumber.startsWith('OR-')).toBe(true);
      expect(orderNumber.length).toBe(20);
      const parts = orderNumber.split('-');
      expect(parts[2].length).toBe(8);
    });

    it('should produce 10,000 unique identifiers with 0 collisions under rapid loop', () => {
      const count = 10000;
      const set = new Set<string>();

      for (let i = 0; i < count; i++) {
        const id = OrderNumberUtil.generate();
        expect(id.length).toBe(20);
        set.add(id);
      }

      expect(set.size).toBe(count);
    });
  });

  describe('generateCheckoutGroupId', () => {
    it('should generate a checkout group identifier with CG- prefix within 50 chars', () => {
      const groupId = OrderNumberUtil.generateCheckoutGroupId();
      expect(groupId).toBeDefined();
      expect(groupId.startsWith('CG-')).toBe(true);
      expect(groupId.length).toBeLessThanOrEqual(50);
      expect(groupId.length).toBe(28); // 3 (CG-) + 8 (ts) + 1 (-) + 16 (rand) = 28 chars
    });

    it('should produce unique checkout group IDs across multiple invocations', () => {
      const id1 = OrderNumberUtil.generateCheckoutGroupId();
      const id2 = OrderNumberUtil.generateCheckoutGroupId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('isValid', () => {
    it('should return true for valid order numbers within 20 chars', () => {
      expect(OrderNumberUtil.isValid('FG-MV3TMQM4-26C51B08')).toBe(true);
      expect(OrderNumberUtil.isValid('FG12345678')).toBe(true);
    });

    it('should return false for invalid or exceeding inputs', () => {
      expect(OrderNumberUtil.isValid('')).toBe(false);
      expect(OrderNumberUtil.isValid('   ')).toBe(false);
      expect(OrderNumberUtil.isValid(null)).toBe(false);
      expect(OrderNumberUtil.isValid(undefined)).toBe(false);
      expect(OrderNumberUtil.isValid('FG-123456789012345678901')).toBe(false); // 25 chars
    });
  });
});
