import nodemailer from "nodemailer";
import ejs from "ejs";

import path from "path";
import config from "../config/index.js";
import logger from "./logger.js";

const transporter = nodemailer.createTransport({
  host: config.smtp_host,
  port: config.smtp_port,
  service: config.smtp_service,
  secure: config.node_env === "production",
  auth: {
    user: config.smtp_user,
    pass: config.smtp_pass,
  },
});

const renderEmailTemplate = async (
  templateName: string,
  templateData: Record<string, any>,
) => {
  const templatePath = path.join(
    process.cwd(),
    "src",
    "templates",
    `${templateName}.ejs`,
  );
  return ejs.renderFile(templatePath, templateData);
};

export const sendEmail = async (
  to: string,
  subject: string,
  templateName: string,
  templateData: Record<string, any>,
) => {
  try {
    const htmlContent = await renderEmailTemplate(templateName, templateData);

    const mailOptions = {
      from: `<${config.smtp_user}>`,
      to,
      subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    logger.error("Error while sending email :", error);
    return false;
  }
};
