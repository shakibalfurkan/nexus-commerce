import crypto from "crypto";

const createInternalSignature = (body: any, secret: string): string => {
  const payload = JSON.stringify(body);
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
};

export default createInternalSignature;
