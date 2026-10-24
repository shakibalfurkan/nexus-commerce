import type { UserRoles } from "../../generated/prisma/enums.js";
import type {
  AdminProfile,
  CustomerProfile,
  SellerProfile,
  ShippingAddress,
  User,
} from "../../generated/prisma/client.js";

/**
 * Response DTOs + mappers. They describe what user-service can actually return
 * for the current Prisma schema (role is a list; the seller profile has no shop
 * columns yet), so a response shape can never drift from the database.
 */

// ─── Response DTOs ───

export interface ShippingAddressDTO {
  id: string;
  recipientName: string;
  street: string;
  apartment: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  label: string | null;
}

export interface CustomerProfileDTO {
  firstName: string;
  lastName: string;
  phone: string | null;
  avatar: string | null;
  dateOfBirth: string | null;
  shippingAddresses: ShippingAddressDTO[];
}

export interface SellerProfileDTO {
  firstName: string;
  lastName: string;
  phone: string | null;
  avatar: string | null;
  bio: string | null;
}

export interface AdminProfileDTO {
  firstName: string;
  lastName: string;
  phone: string | null;
  avatar: string | null;
}

export interface UserResponseDTO {
  id: string;
  email: string;
  role: UserRoles[];
  isActive: boolean;
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
  profile: CustomerProfileDTO | SellerProfileDTO | AdminProfileDTO | null;
}

/** Input for creating the bare user record (profiles are written separately). */
export interface CreateUserRecordInput {
  id: string;
  email: string;
  role: UserRoles;
}

// ─── Mapper Functions ───

type UserWithProfiles = User & {
  customerProfile?:
    | (CustomerProfile & { shippingAddresses: ShippingAddress[] })
    | null;
  sellerProfile?: SellerProfile | null;
  adminProfile?: AdminProfile | null;
};

function mapShippingAddress(address: ShippingAddress): ShippingAddressDTO {
  return {
    id: address.id,
    recipientName: address.recipientName,
    street: address.street,
    apartment: address.apartment ?? null,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    isDefault: address.isDefault,
    label: address.label ?? null,
  };
}

function mapCustomerProfile(
  profile: CustomerProfile & { shippingAddresses: ShippingAddress[] },
): CustomerProfileDTO {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone ?? null,
    avatar: profile.avatar ?? null,
    dateOfBirth: profile.dateOfBirth?.toISOString() ?? null,
    shippingAddresses: profile.shippingAddresses.map(mapShippingAddress),
  };
}

function mapSellerProfile(profile: SellerProfile): SellerProfileDTO {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone ?? null,
    avatar: profile.avatar ?? null,
    bio: profile.bio ?? null,
  };
}

function mapAdminProfile(profile: AdminProfile): AdminProfileDTO {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone ?? null,
    avatar: profile.avatar ?? null,
  };
}

export function toUserResponseDTO(user: UserWithProfiles): UserResponseDTO {
  let profile: CustomerProfileDTO | SellerProfileDTO | AdminProfileDTO | null =
    null;

  if (user.customerProfile) {
    profile = mapCustomerProfile(user.customerProfile);
  } else if (user.sellerProfile) {
    profile = mapSellerProfile(user.sellerProfile);
  } else if (user.adminProfile) {
    profile = mapAdminProfile(user.adminProfile);
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    profile,
  };
}
