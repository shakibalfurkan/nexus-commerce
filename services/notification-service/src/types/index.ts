export type TSendOtpPayload = {
  reason: "email-verification" | "auth-verification";
  email: string;
  userName: string;
  otp: string;
  userType: "CUSTOMER" | "SELLER";
};
