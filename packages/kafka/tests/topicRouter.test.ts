import { describe, expect, it } from "vitest";
import { resolveTopic } from "../src/topicRouter.js";
import { KafkaTopics, DLQEventTypes, AuthDomainEventTypes, UserDomainEventTypes } from "@nexus/event-contracts";

describe("resolveTopic", () => {
  it("routes the dead-letter event to the DLQ topic", () => {
    expect(resolveTopic(DLQEventTypes.DEAD_LETTER_EVENT)).toBe(KafkaTopics.DLQ);
  });

  it("routes every domain event to the DOMAIN_EVENTS topic", () => {
    expect(resolveTopic(AuthDomainEventTypes.EMAIL_VERIFICATION_OTP_SENT)).toBe(KafkaTopics.DOMAIN_EVENTS);
    expect(resolveTopic(AuthDomainEventTypes.PASSWORD_RESET_REQUESTED)).toBe(KafkaTopics.DOMAIN_EVENTS);
    expect(resolveTopic(AuthDomainEventTypes.SELLER_PROFILE_REQUESTED)).toBe(KafkaTopics.DOMAIN_EVENTS);
    expect(resolveTopic(AuthDomainEventTypes.CUSTOMER_PROFILE_REQUESTED)).toBe(KafkaTopics.DOMAIN_EVENTS);
    expect(resolveTopic(UserDomainEventTypes.USER_REGISTERED)).toBe(KafkaTopics.DOMAIN_EVENTS);
  });

  it("falls through to DOMAIN_EVENTS for unknown event types", () => {
    expect(resolveTopic("some.future.event")).toBe(KafkaTopics.DOMAIN_EVENTS);
    expect(resolveTopic("")).toBe(KafkaTopics.DOMAIN_EVENTS);
  });

  it("never returns undefined", () => {
    expect(resolveTopic(DLQEventTypes.DEAD_LETTER_EVENT)).toBeDefined();
    expect(resolveTopic("anything")).toBeDefined();
  });
});
