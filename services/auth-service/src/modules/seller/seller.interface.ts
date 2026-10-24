/**
 * Seller-app registration fields.
 *
 * Seller-specific data is limited to what the Prisma `SellerProfile` model can
 * actually persist (name, phone, bio). Shop name / payout / tax columns do not
 * exist in the schema, so they are not collected here.
 */
export interface ISellerRegisterRequestDTO {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone?: string | undefined;
  bio?: string | undefined;
}

export interface IVerifyRegistrationDTO {
  email: string;
  otp: string;
}
