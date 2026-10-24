/** Internal (auth-service → user-service) seller account provisioning. */
export interface ProvisionSellerProfileInput {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | undefined;
  bio?: string | undefined;
}
