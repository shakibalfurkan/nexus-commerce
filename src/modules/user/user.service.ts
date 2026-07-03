import { BadRequestError } from "../../errors/AppError.js";
import { UserRoles } from "../../generated/prisma/enums.js";
import { prisma } from "../../lib/prisma.js";
import type { IUserProfileData } from "./user.interface.js";

const createUserProfile = async (payload: IUserProfileData) => {
  const { id, firstName, lastName, email, role, shopData } = payload;

  return await prisma.$transaction(async (tx) => {
    const isUserExists = await tx.user.findUnique({
      where: {
        email,
      },
    });

    if (isUserExists) {
      throw new BadRequestError("User with this email already exists", "email");
    }

    const user = await tx.user.create({
      data: {
        id,
        email,
        role,
      },
    });

    if (role === UserRoles.CUSTOMER) {
      await tx.customerProfile.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
        },
      });
    } else if (role === UserRoles.SELLER) {
      if (!shopData) {
        throw new BadRequestError(
          "Shop data is required for seller registration",
          "shopData",
        );
      }

      await tx.sellerProfile.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          shopName: shopData.shopName,
          shopEmail: shopData.shopEmail,
          shopPhone: shopData.shopPhone,
          shopAddress: {
            create: {
              street: shopData.shopAddress.street,
              city: shopData.shopAddress.city,
              state: shopData.shopAddress.state,
              postalCode: shopData.shopAddress.postalCode,
              country: shopData.shopAddress.country,
              lat: shopData.shopAddress.coordinates?.lat ?? null,
              lng: shopData.shopAddress.coordinates?.lng ?? null,
            },
          },
        },
      });
    } else if ([UserRoles.ADMIN, UserRoles.SUPER_ADMIN].includes(role)) {
      await tx.adminProfile.create({
        data: { userId: user.id, firstName, lastName },
      });
    }

    return user;
  });
};

export const UserService = {
  createUserProfile,
};
