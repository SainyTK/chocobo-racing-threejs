/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The signaling Worker's origin, such as https://cbr-signal.sainytk.com. */
  readonly VITE_SIGNAL_URL?: string;
}
