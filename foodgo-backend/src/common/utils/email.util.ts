export class EmailUtil {
  /**
   * Normalizes an email address: trims whitespace and converts to lower case.
   */
  static normalize(email: string): string {
    if (!email) return '';
    return email.trim().toLowerCase();
  }

  /**
   * Validates standard RFC 5322 email syntax with a maximum length limit of 255 chars.
   */
  static isValid(email: string): boolean {
    if (!email) return false;
    const normalized = this.normalize(email);
    if (normalized.length > 255) return false;

    // RFC-compliant email regex: checks standard user@domain.tld structure
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

    return emailRegex.test(normalized);
  }

  /**
   * Masks an email address for safe logging in logs and audit trails.
   * Example: 'customer@example.com' -> 'cu*****@example.com'
   * Example: 'ab@domain.com' -> 'a*@domain.com'
   */
  static mask(email: string): string {
    if (!email) return '****';
    const normalized = this.normalize(email);
    const parts = normalized.split('@');
    if (parts.length !== 2) return '****';

    const [localPart, domain] = parts;
    if (localPart.length <= 2) {
      return `${localPart[0]}*@${domain}`;
    }

    const visible = localPart.slice(0, 2);
    const maskLength = Math.min(localPart.length - 2, 5);
    return `${visible}${'*'.repeat(maskLength)}@${domain}`;
  }
}
