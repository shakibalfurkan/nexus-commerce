/** Fields collected by the customer registration form. */
export interface ICustomerRegisterRequestDTO {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  marketingOptIn: boolean;
}

export interface IVerifyRegistrationDTO {
  email: string;
  otp: string;
}
