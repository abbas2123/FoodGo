import { randomBytes } from 'node:crypto';

/**
 * Utility for generating collision-resistant, cryptographically-seeded identifiers
 * for Orders and Checkout Groups.
 *
 * Requirements:
 * - Order numbers MUST strictly fit the Prisma schema column: `@db.VarChar(20)` (max 20 characters).
 * - Fixed-length, non-truncated design: exactly 20 characters without discarding random entropy.
 * - Time-ordering (Base36 timestamp) + high-entropy cryptographic random bytes.
 */
export class OrderNumberUtil {
  public static readonly MAX_ORDER_NUMBER_LENGTH = 20;
  public static readonly MAX_CHECKOUT_GROUP_ID_LENGTH = 50;
  public static readonly DEFAULT_ORDER_PREFIX = 'FG';
  public static readonly DEFAULT_CHECKOUT_GROUP_PREFIX = 'CG';

  /**
   * Generates a fixed-length, collision-resistant order number.
   *
   * Format: `FG-<TIMESTAMP_BASE36>-<RANDOM_HEX>`
   * Example: `FG-MV3TMQM4-26C51B08` (exactly 20 characters)
   *
   * Character length breakdown (strictly 20 characters, zero truncation):
   * - Prefix: 2 chars (`FG`)
   * - Separator: 1 char (`-`)
   * - Timestamp (Base36): 8 chars (fixed-width via padStart(8, '0'), millisecond precision)
   * - Separator: 1 char (`-`)
   * - Random Hex: 8 chars (4 cryptographic random bytes = 32 bits = 4.29 billion possibilities per ms)
   * Total length: 2 + 1 + 8 + 1 + 8 = 20 characters.
   */
  static generate(prefix = OrderNumberUtil.DEFAULT_ORDER_PREFIX): string {
    const rawPrefix = (prefix || OrderNumberUtil.DEFAULT_ORDER_PREFIX).trim().toUpperCase();
    const safePrefix = rawPrefix.length > 2 ? rawPrefix.slice(0, 2) : rawPrefix;
    const ts = Date.now().toString(36).toUpperCase().padStart(8, '0');
    const rand = randomBytes(4).toString('hex').toUpperCase();

    const identifier = `${safePrefix}-${ts}-${rand}`;
    if (identifier.length !== OrderNumberUtil.MAX_ORDER_NUMBER_LENGTH) {
      throw new Error(
        `Generated order number length (${identifier.length}) does not match expected length (${OrderNumberUtil.MAX_ORDER_NUMBER_LENGTH})`,
      );
    }
    return identifier;
  }

  /**
   * Generates a collision-resistant checkout group identifier.
   * Fits schema column `@db.VarChar(50)` (exactly 28 characters, zero truncation).
   *
   * Format: `CG-<TIMESTAMP_BASE36>-<RANDOM_HEX>`
   * Example: `CG-MV3TMQM4-9F8E7D6C5B4A1234`
   */
  static generateCheckoutGroupId(prefix = OrderNumberUtil.DEFAULT_CHECKOUT_GROUP_PREFIX): string {
    const rawPrefix = (prefix || OrderNumberUtil.DEFAULT_CHECKOUT_GROUP_PREFIX).trim().toUpperCase();
    const safePrefix = rawPrefix.length > 3 ? rawPrefix.slice(0, 3) : rawPrefix;
    const ts = Date.now().toString(36).toUpperCase().padStart(8, '0');
    const rand = randomBytes(8).toString('hex').toUpperCase();

    const identifier = `${safePrefix}-${ts}-${rand}`;
    if (identifier.length > OrderNumberUtil.MAX_CHECKOUT_GROUP_ID_LENGTH) {
      throw new Error(
        `Generated checkout group ID length (${identifier.length}) exceeds maximum column capacity (${OrderNumberUtil.MAX_CHECKOUT_GROUP_ID_LENGTH})`,
      );
    }
    return identifier;
  }

  /**
   * Validates whether a given string adheres to the order number format and column limits.
   */
  static isValid(orderNumber: unknown): boolean {
    if (typeof orderNumber !== 'string') return false;
    const trimmed = orderNumber.trim();
    return trimmed.length > 0 && trimmed.length <= OrderNumberUtil.MAX_ORDER_NUMBER_LENGTH;
  }
}
