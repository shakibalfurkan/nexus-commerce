import { prisma } from "../lib/prisma.js";
import { EventBus } from "./eventBus.js";
import { KafkaTopics } from "../config/kafka.js";
import { DomainEventTypes, type TDomainEvent } from "./eventTypes.js";
import logger from "../utils/logger.js";

export async function startProvisionedProfilesConsumer(): Promise<void> {
  await EventBus.subscribe(
    KafkaTopics.DOMAIN_EVENTS,
    "auth-service-provisioned-profiles",
    async (event: TDomainEvent) => {
      if (event.eventName === DomainEventTypes.SELLER_PROFILE_CREATED) {
        await handleSellerProfileCreated(event);
      } else if (
        event.eventName === DomainEventTypes.CUSTOMER_PROFILE_CREATED
      ) {
        await handleCustomerProfileCreated(event);
      }
    },
  );
}

async function handleSellerProfileCreated(event: any): Promise<void> {
  const { userId, syncedVersion } = event.payload;

  try {
    const credential = await prisma.credential.findUnique({
      where: { id: userId },
    });

    if (!credential) {
      logger.warn(
        `[handleSellerProfileCreated] Credential not found for userId ${userId}`,
      );
      return;
    }

    // Version check — only apply if incoming syncedVersion is newer
    if (syncedVersion <= credential.syncedVersion) {
      logger.warn(
        `[handleSellerProfileCreated] Stale event ignored for userId ${userId} (version ${syncedVersion} <= ${credential.syncedVersion})`,
      );
      return;
    }

    // Append SELLER role if not already present
    if (!credential.role.includes("SELLER")) {
      await prisma.credential.update({
        where: { id: userId },
        data: {
          role: [...credential.role, "SELLER"],
          syncedVersion,
        },
      });
      logger.info(
        `[handleSellerProfileCreated] SELLER role added to credential ${userId}`,
      );
    } else {
      // Update version even if role already present (catch-up sync)
      await prisma.credential.update({
        where: { id: userId },
        data: { syncedVersion },
      });
    }
  } catch (error) {
    logger.error(
      `[handleSellerProfileCreated] Error processing event for userId ${userId}`,
      error,
    );
  }
}

async function handleCustomerProfileCreated(event: any): Promise<void> {
  const { userId, syncedVersion } = event.payload;

  try {
    const credential = await prisma.credential.findUnique({
      where: { id: userId },
    });

    if (!credential) {
      logger.warn(
        `[handleCustomerProfileCreated] Credential not found for userId ${userId}`,
      );
      return;
    }

    // Version check
    if (syncedVersion <= credential.syncedVersion) {
      logger.warn(
        `[handleCustomerProfileCreated] Stale event ignored for userId ${userId} (version ${syncedVersion} <= ${credential.syncedVersion})`,
      );
      return;
    }

    // Append CUSTOMER role if not already present
    if (!credential.role.includes("CUSTOMER")) {
      await prisma.credential.update({
        where: { id: userId },
        data: {
          role: [...credential.role, "CUSTOMER"],
          syncedVersion,
        },
      });
      logger.info(
        `[handleCustomerProfileCreated] CUSTOMER role added to credential ${userId}`,
      );
    } else {
      // Update version even if role already present
      await prisma.credential.update({
        where: { id: userId },
        data: { syncedVersion },
      });
    }
  } catch (error) {
    logger.error(
      `[handleCustomerProfileCreated] Error processing event for userId ${userId}`,
      error,
    );
  }
}
