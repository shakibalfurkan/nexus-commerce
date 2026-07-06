import type { UserRoles } from "../../generated/prisma/enums.js";

// ─── Input DTOs ───

export interface CreateUserProfileDTO {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRoles;
  phone?: string;
  avatar?: string;
  dateOfBirth?: string;
  shopData?: {
    shopName: string;
    shopEmail: string;
    shopPhone: string;
    shopAddress: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      coordinates?: {
        lat: number;
        lng: number;
      };
    };
  };
}

export interface UpdateUserDTO {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  dateOfBirth?: string;
}

export interface UpdateSellerDTO extends UpdateUserDTO {
  shopName?: string;
  shopEmail?: string;
  shopPhone?: string;
  shopAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  stripeConnectId?: string;
}

// ─── Response DTOs ───

export interface UserResponseDTO {
  id: string;
  email: string;
  role: UserRoles;
  isActive: boolean;
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
  profile: CustomerProfileDTO | SellerProfileDTO | AdminProfileDTO | null;
}

export interface CustomerProfileDTO {
  firstName: string;
  lastName: string;
  phone: string | null;
  avatar: string | null;
  dateOfBirth: string | null;
  shippingAddresses: ShippingAddressDTO[];
}

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

export interface SellerProfileDTO {
  firstName: string;
  lastName: string;
  phone: string | null;
  avatar: string | null;
  shopName: string;
  shopEmail: string;
  shopPhone: string;
  shopAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    lat: number | null;
    lng: number | null;
  } | null;
  stripeConnectId: string | null;
  onboardingComplete: boolean;
  commissionRate: number;
  totalProducts: number;
  salesCount: number;
  totalRevenue: number;
  rating: number;
  reviewCount: number;
}

export interface AdminProfileDTO {
  firstName: string;
  lastName: string;
  phone: string | null;
  avatar: string | null;
}

// ─── Mapper Functions ───

import type {
  User,
  CustomerProfile,
  SellerProfile,
  AdminProfile,
  ShippingAddress,
  ShopAddress,
} from "../../generated/prisma/client.js";

type UserWithProfiles = User & {
  customerProfile?:
    | (CustomerProfile & { shippingAddresses: ShippingAddress[] })
    | null;
  sellerProfile?: (SellerProfile & { shopAddress?: ShopAddress | null }) | null;
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

function mapSellerProfile(
  profile: SellerProfile & { shopAddress?: ShopAddress | null },
): SellerProfileDTO {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone ?? null,
    avatar: profile.avatar ?? null,
    shopName: profile.shopName,
    shopEmail: profile.shopEmail,
    shopPhone: profile.shopPhone,
    shopAddress: profile.shopAddress
      ? {
          street: profile.shopAddress.street,
          city: profile.shopAddress.city,
          state: profile.shopAddress.state,
          postalCode: profile.shopAddress.postalCode,
          country: profile.shopAddress.country,
          lat: profile.shopAddress.lat ?? null,
          lng: profile.shopAddress.lng ?? null,
        }
      : null,
    stripeConnectId: profile.stripeConnectId ?? null,
    onboardingComplete: profile.onboardingComplete,
    commissionRate: profile.commissionRate,
    totalProducts: profile.totalProducts,
    salesCount: profile.salesCount,
    totalRevenue: profile.totalRevenue,
    rating: profile.rating,
    reviewCount: profile.reviewCount,
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

/**
 * Maps a raw Prisma User (with nested profiles) to a clean UserResponseDTO.
 * This is the ONLY projection function that should be used to return user data.
 *
 * @param user - The Prisma User object with profile includes
 * @returns A sanitized DTO safe for external consumption
 * @throws {Error} If the user has an unrecognized role
 */
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

/**
 * Type guard to check if a user has a specific role.
 * Use this instead of raw enum comparisons to ensure type safety.
 */
export function isRole<T extends UserRoles>(
  user: { role: UserRoles },
  role: T,
): user is { role: T } & typeof user {
  return user.role === role;
}
