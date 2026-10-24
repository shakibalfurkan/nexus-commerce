/**
 * Internal (auth-service → user-service) admin account provisioning.
 *
 * `SUPER_ADMIN` is intentionally NOT accepted here: the only admin creation
 * path today is consuming an ADMIN invite. The planned super-admin bootstrap is
 * a separate task with its own, explicit provisioning rule.
 */
export interface ProvisionAdminProfileInput {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | undefined;
}
