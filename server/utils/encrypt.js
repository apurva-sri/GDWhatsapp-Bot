// AES token encryption utilities
const crypto = require("crypto");

const algorithm = "aes-256-cbc";

const encryptData = (data, encryptionKey) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    algorithm,
    Buffer.from(encryptionKey),
    iv,
  );
  let encrypted = cipher.update(data);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
};

const decryptData = (encryptedData, encryptionKey) => {
  const parts = encryptedData.split(":");
  const iv = Buffer.from(parts.shift(), "hex");
  const decipher = crypto.createDecipheriv(
    algorithm,
    Buffer.from(encryptionKey),
    iv,
  );
  let decrypted = decipher.update(Buffer.from(parts.join(":"), "hex"));
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
};

module.exports = {
  encryptData,
  decryptData,
};
