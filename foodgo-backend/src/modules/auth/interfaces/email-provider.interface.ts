export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';

export interface IEmailProvider {
  /**
   * Dispatches a 6-digit verification OTP to the specified recipient email address.
   * Throws an exception if delivery fails.
   */
  sendOtp(email: string, otp: string): Promise<void>;
}
