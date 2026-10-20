export interface SmsResult {
  // Set only by the console sender in development, so the web app can show the code.
  devCode?: string
}

export interface OtpSender {
  sendOtp(phone: string, code: string): Promise<SmsResult>
}

// No SMS is sent; nothing is logged either (codes never go to logs).
const consoleSender: OtpSender = {
  sendOtp: (_phone, code) => Promise.resolve({ devCode: code }),
}

// TODO(tech-debt): add a real Nepali SMS provider (e.g. Sparrow SMS / Aakash SMS) and pick it by
// SMS_PROVIDER before launch. env validation already refuses SMS_PROVIDER=console in production.
export const otpSender: OtpSender = consoleSender
