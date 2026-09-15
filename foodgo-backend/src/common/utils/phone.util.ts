export class PhoneUtil {
  static normalize(phone: string): string {
    if (!phone) return '';
    const trimmed = phone.trim();
    if (trimmed.startsWith('+')) {
      return '+' + trimmed.slice(1).replace(/\D/g, '');
    }
    return trimmed.replace(/\D/g, '');
  }

  static isValid(phone: string): boolean {
    const normalized = this.normalize(phone);
    const phoneRegex = /^\+?[1-9]\d{5,14}$/;
    return phoneRegex.test(normalized);
  }

  static mask(phone: string): string {
    const normalized = this.normalize(phone);
    if (normalized.length <= 4) return '****';
    const start = normalized.slice(0, 3);
    const end = normalized.slice(-3);
    return `${start}****${end}`;
  }
}
