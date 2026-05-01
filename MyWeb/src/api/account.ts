export interface AccountCredentials {
  server: string;
  username: string;
  password: string;
}

export interface EncryptedCredentials {
  salt: string;   // base64
  iv: string;     // base64
  data: string;   // base64
}

export async function encryptCredentials(
  creds: AccountCredentials,
  password: string
): Promise<EncryptedCredentials> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(creds))
  );

  return {
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
  };
}

export async function decryptCredentials(
  encrypted: EncryptedCredentials,
  password: string
): Promise<AccountCredentials> {
  const salt = Uint8Array.from(atob(encrypted.salt), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(encrypted.iv), (c) => c.charCodeAt(0));
  const data = Uint8Array.from(atob(encrypted.data), (c) => c.charCodeAt(0));

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  return JSON.parse(new TextDecoder().decode(plaintext));
}
