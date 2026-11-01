/** Web Crypto exists in Node and in browsers, including plain-HTTP LAN pages where `crypto.randomUUID` is missing. */
export function randomHex(bytes: number) {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values, b => b.toString(16).padStart(2, '0')).join('');
}
export const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
/** Room codes are six upper-case hex characters. */
export const randomRoomCode = () => randomHex(3).toUpperCase();
