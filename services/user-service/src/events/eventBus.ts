import { kafka, producer } from "../config/kafka.js";
import logger from "../utils/logger.js";
import type { KafkaTopics } from "../config/kafka.js";

export const EventBus = {
  publish: async (
    topic: (typeof KafkaTopics)[keyof typeof KafkaTopics],
    eventId: string,
    message: unknown,
    traceparent?: string,
  ) => {
    try {
      if (!producer) {
        logger.warn(
          `[EventBus] Kafka producer not initialized — skipping publish to ${topic}`,
        );
        return;
      }
      await producer.send({
        topic,
        messages: [
          {
            key: eventId,
            value: JSON.stringify(message),
            headers: traceparent ? { traceparent } : {},
          },
        ],
      });
      logger.info(`[EventBus] 🚀 Sent to ${topic}`);
    } catch (error) {
      logger.error(`[EventBus] Publish Error:`, error);
    }
  },

  subscribe: async (
    topic: (typeof KafkaTopics)[keyof typeof KafkaTopics],
    groupId: string,
    handler: (data: any) => Promise<void>,
  ) => {
    if (!kafka) {
      logger.warn(
        `[EventBus] Kafka not initialized — cannot subscribe to ${topic}`,
      );
      return;
    }
    const consumer = kafka.consumer({
      groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });

    logger.info(`[EventBus] 🎧 Listening to ${topic} as ${groupId}...`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const payload = JSON.parse(message.value?.toString() || "{}");
          await handler(payload);
        } catch (error) {
          logger.error(`[EventBus] Processing Error:`, error);
        }
      },
    });
  },
};
