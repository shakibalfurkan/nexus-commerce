/** Internal (auth-service → user-service) customer account provisioning. */
export interface ProvisionCustomerProfileInput {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | undefined;
  avatar?: string | undefined;
  dateOfBirth?: string | undefined;
}

/** Authenticated customer attaching a seller profile to their own account. */
export interface BecomeSellerInput {
  firstName: string;
  lastName: string;
  phone?: string | undefined;
  bio?: string | undefined;
}
