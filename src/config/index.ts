import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  node_env: process.env.NODE_ENV,
  serviceName: process.env.SERVICE_NAME || "user-service",
  port: process.env.PORT,

  kafka: {
    broker: process.env.KAFKA_BROKER,
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },

  jwt: {
    access_token_secret: process.env.JWT_ACCESS_TOKEN_SECRET,
    refresh_token_secret: process.env.JWT_REFRESH_TOKEN_SECRET,
  },

  internal_service_secret: process.env.INTERNAL_SERVICE_SECRET,

  allowed_origins:
    process.env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()) ??
    [],

  user_client_url: process.env.USER_CLIENT_URL ?? "http://localhost:3000",
  seller_client_url: process.env.SELLER_CLIENT_URL ?? "http://localhost:5173",
  admin_client_url: process.env.ADMIN_CLIENT_URL ?? "http://localhost:5174",
} as const;
