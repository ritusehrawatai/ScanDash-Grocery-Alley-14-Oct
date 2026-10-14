import type { Reader } from '@stripe/terminal-js';

export type ReaderConnectionState = 'Disconnected' | 'Connecting' | 'Connected' | 'Error';

export interface TerminalDeviceState {
  state: ReaderConnectionState;
  reader: Reader | null;
  errorMessage: string | null;
  discoveredReaders: Reader[];
  isDiscovering: boolean;
  isSimulated: boolean;
  batteryLevel?: number | null;
}
