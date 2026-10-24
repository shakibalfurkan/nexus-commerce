import {
  SellerProfileAttachedEventSchema,
  UserDeletedEventSchema,
  UserDomainEventTypes,
  UserRestoredEventSchema,
} from "@nexus/event-contracts";
import {
  publishDeadLetterEvent,
  type SubscribeMessageContext,
} from "@nexus/kafka";
import { eventBus } from "../eventBus.js";
import logger from "../../utils/logger.js";
import { UserRoles } from "../../generated/prisma/enums.js";
import { AuthService } from "../../modules/auth/auth.service.js";
import * as credentialRepo from "../../repositories/credential.js";
import { revokeAllRefreshTokens } from "../../repositories/refreshToken.js";

/**
 * auth-service's domain-event consumer.
 *
 * auth-service owns credentials (password, roles, security state) and keeps a
 * read-only replica of user-service state, synced only by events. The one
 * inbound event handled here is a new role being attached to an existing
 * account in user-service (`user.seller.profile.attached`) — no cross-service
 * database writes are involved.
 *
 * Failure semantics:
 *  - unknown event type on the shared topic → ignored (ACK), other services'
 *    events are not this consumer's business;
 *  - unparseable / schema-invalid payload → routed to the DLQ then ACK, so a
 *    permanently malformed message cannot loop forever;
 *  - database failure → rethrown so KafkaJS redelivers (at-least-once).
 */
export const ROLE_SYNC_CONSUMER_GROUP_ID = "auth-service-user-sync";

async function routePoisonMessage(
  context: SubscribeMessageContext,
  rawValue: string | null,
  failureReason: string,
): Promise<void> {
  const dedupeKey = `${context.topic}:${context.partition}:${context.offset}`;

  await publishDeadLetterEvent({
    serviceName: "auth-service",
    eventId: dedupeKey,
    eventType: null,
    failureStage: "consume",
    errorMessage: failureReason,
    rawPayload: rawValue ?? "",
    traceparent: context.traceparent,
    correlationId: context.headers.correlationid,
    publish: eventBus
      ? (params) => {
          const bus = eventBus;
          return bus ? bus.publish(params) : Promise.resolve();
        }
      : async () => {
          logger.warn(
            "[RoleSync] Kafka unconfigured — poison message logged only",
            {
              eventId: dedupeKey,
            },
          );
        },
    logger,
  });
}

export async function handleRoleSyncMessage(
  rawValue: string | null,
  context: SubscribeMessageContext,
): Promise<void> {
  let payload: unknown;

  try {
    payload = rawValue ? JSON.parse(rawValue) : undefined;
  } catch {
    await routePoisonMessage(
      context,
      rawValue,
      "Kafka message is not valid JSON",
    );
    return;
  }

  const eventType = (payload as { eventType?: unknown } | undefined)?.eventType;

  if (eventType === UserDomainEventTypes.USER_DELETED) {
    const parsed = UserDeletedEventSchema.safeParse(payload);
    if (!parsed.success) {
      await routePoisonMessage(context, rawValue, "user.deleted failed schema validation");
      return;
    }
    const { userId, deletedAt } = parsed.data.payload;
    await credentialRepo.markDeleted(userId, new Date(deletedAt));
    await revokeAllRefreshTokens(userId);
    return;
  }

  if (eventType === UserDomainEventTypes.USER_RESTORED) {
    const parsed = UserRestoredEventSchema.safeParse(payload);
    if (!parsed.success) {
      await routePoisonMessage(context, rawValue, "user.restored failed schema validation");
      return;
    }
    await credentialRepo.markRestored(parsed.data.payload.userId);
    return;
  }

  if (eventType !== UserDomainEventTypes.SELLER_PROFILE_ATTACHED) {
    return;
  }

  const parsed = SellerProfileAttachedEventSchema.safeParse(payload);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");

    await routePoisonMessage(
      context,
      rawValue,
      `${UserDomainEventTypes.SELLER_PROFILE_ATTACHED} failed schema validation: ${details}`,
    );
    return;
  }

  await AuthService.addRoleToCredential(
    parsed.data.payload.userId,
    UserRoles.SELLER,
  );
}
