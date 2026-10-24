import crypto from "crypto";

const createInternalSignature = (
  method: string,
  path: string,
  body: unknown,
  timestamp: string,
  secret: string,
): string => {
  const payload = `${method.toUpperCase()}:${path}:${timestamp}:${JSON.stringify(body)}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
};

export default createInternalSignature;
