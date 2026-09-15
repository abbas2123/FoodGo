export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export interface ISmsProvider {
  sendOtp(phone: string, otp: string): Promise<void>;
}
