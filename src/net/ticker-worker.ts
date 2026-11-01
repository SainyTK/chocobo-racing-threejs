/** Posts a message every `ms` milliseconds, given by the first message it receives. See `background-timer.ts`. */
const scope = self as unknown as { onmessage: ((e: MessageEvent<number>) => void) | null; postMessage(message: unknown): void };
scope.onmessage = e => { scope.onmessage = null; setInterval(() => scope.postMessage(0), e.data); };
