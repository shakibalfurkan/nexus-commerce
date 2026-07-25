import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  node_env: process.env.NODE_ENV,
  isDevelopment: process.env.NODE_ENV === "development",
  serviceName: process.env.SERVICE_NAME,
  port: process.env.PORT,

  kafka: {
    broker: process.env.KAFKA_BROKER,
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD,
  },

  smtp_host: process.env.SMTP_HOST,
  smtp_port: Number(process.env.SMTP_PORT) || 587,
  smtp_service: process.env.SMTP_SERVICE,
  smtp_user: process.env.SMTP_USER,
  smtp_pass: process.env.SMTP_PASS,
} as const;
