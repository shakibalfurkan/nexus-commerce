import type { ICustomerRegisterRequestDTO } from "./customer.interface.js";
import * as IdentityRepository from "../identity/identity.repository.js";
import { BadRequestError } from "../../errors/AppError.js";
import checkOtpRestrictions from "../../utils/otp/checkOtpRestrictions.js";
import {
  createEventMetadata,
  DomainEventTypes,
  OtpPurpose,
} from "../../events/eventTypes.js";
import trackOtpRequests from "../../utils/otp/trackOtpRequests.js";
import { hashPassword } from "../../utils/passwordHandler.js";
import config from "../../config/index.js";
import generateOtp from "../../utils/otp/generateOtp.js";
import { redisClient } from "../../config/redis.js";
import { v5 as uuidv5 } from "uuid";
import { UserRoles } from "../../generated/prisma/enums.js";
import { emitDomainEvent } from "../../events/outboxWriter.js";

const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

const customerRegisterRequest = async (
  payload: ICustomerRegisterRequestDTO,
): Promise<void> => {
  const {
    firstName,
    lastName,
    email,
    password,
    confirmPassword,
    acceptTerms,
    marketingOptIn,
  } = payload;

  if (password !== confirmPassword) {
    throw new BadRequestError("Passwords do not match");
  }

  const existingUser = await IdentityRepository.findByEmail(email);
  if (existingUser) {
    throw new BadRequestError("Email already in use", "email");
  }

  await checkOtpRestrictions(email, OtpPurpose.EMAIL_VERIFICATION);
  await trackOtpRequests(email, OtpPurpose.EMAIL_VERIFICATION);

  const hashedPassword = await hashPassword(
    confirmPassword,
    config.bcrypt_salt_round,
  );

  const otp = generateOtp();

  const registrationData = {
    firstName,
    lastName,
    email,
    password: hashedPassword,
    acceptTerms,
    marketingOptIn,
  };

  await redisClient.setex(
    `auth:reg:${UserRoles.CUSTOMER}:${email}`,
    35 * 60,
    JSON.stringify(registrationData),
  );

  await redisClient.setex(
    `auth:otp:${OtpPurpose.EMAIL_VERIFICATION}:${email}`,
    5 * 60,
    otp,
  );

  const aggregateId = uuidv5(email, DNS_NAMESPACE);

  await emitDomainEvent({
    eventName: DomainEventTypes.EMAIL_VERIFICATION_OTP_SENT,
    aggregateId,
    payload: {
      firstName,
      email,
      otp,
    },
    metadata: createEventMetadata(),
  });
};

export const CustomerService = { customerRegisterRequest };
