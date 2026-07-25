export enum KafkaTopics {
  DOMAIN_EVENTS = "domain-events",
  NOTIFICATIONS = "notifications",
  ANALYTICS = "analytics-events",
  DLQ = "dead-letter-queue",
  PAYMENTS = "payments-events",
}

export enum NotificationEventTypes {
  AUTH_REGISTERED = "registered",
  AUTH_OTP = "otp.requested",
  AUTH_PASSWORD_RESET = "password.reset",

  // Orders
  ORDER_CONFIRMED = "order.confirmed",
  ORDER_SHIPPED = "order.shipped",

  // Payments
  PAYMENT_FAILED = "payment.failed",
}

export enum DomainEventTypes {
  USER_CREATED = "user.created",
  USER_BLOCKED = "user.blocked",
  ORDER_CREATED = "order.created",
  PRODUCT_UPDATED = "product.updated",
}
