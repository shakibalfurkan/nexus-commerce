import { handleSendOtp } from "../handlers/handleSendOtp.js";
import { handleUserWelcome } from "../handlers/handleUserWelcome.js";
import type { TSendOtpPayload } from "../types/index.js";
import logger from "../utils/logger.js";
import { EventBus } from "./event-bus.js";
import { KafkaTopics, NotificationEventTypes } from "./event-types.js";

export const startKafkaConsumer = async () => {
  logger.info("Starting Kafka Consumer...");

  await EventBus.subscribe(
    KafkaTopics.NOTIFICATIONS,
    "notification-service-group",
    async (event: Record<string, any>) => {
      switch (event.eventType) {
        case NotificationEventTypes.AUTH_REGISTERED:
          await handleUserWelcome(event.payload);
          break;

        case NotificationEventTypes.AUTH_OTP:
          await handleSendOtp(event.payload as TSendOtpPayload);
          break;

        default:
          break;
      }
    },
  );
};
