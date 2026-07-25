import crypto from "crypto";
export default function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}
