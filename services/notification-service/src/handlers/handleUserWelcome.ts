import logger from "../utils/logger.js";
import { sendEmail } from "../utils/sendMail.js";

export const handleUserWelcome = async (payload: {
  userName: string;
  email: string;
}) => {
  const { userName, email } = payload;

  await sendEmail(email, "Welcome to ClassyShop!", "welcome", {
    userName,
  });

  logger.info(`Welcome email sent to ${email} for user: ${userName}`);
};
