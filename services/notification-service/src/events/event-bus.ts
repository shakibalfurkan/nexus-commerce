import { kafka, producer } from "../config/kafka.js";
import logger from "../utils/logger.js";
import { KafkaTopics } from "./event-types.js";

let isProducerConnected = false;

export const EventBus = {
  publish: async (topic: KafkaTopics, message: any) => {
    try {
      if (!isProducerConnected) {
        await producer.connect();
        isProducerConnected = true;
      }

      await producer.send({
        topic,
        messages: [{ value: JSON.stringify(message) }],
      });
      logger.info(`[EventBus] 🚀 Sent to ${topic}`);
    } catch (error) {
      logger.error(`[EventBus] Publish Error:`, error);
    }
  },

  subscribe: async (
    topic: KafkaTopics,
    groupId: string,
    handler: (data: any) => Promise<void>,
  ) => {
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
