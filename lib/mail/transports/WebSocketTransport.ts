// transports/WebSocketTransport.ts
import type { Transport } from '../core/Transport';

export class WebSocketTransport implements Transport {
  private ws: WebSocket | null = null;
  private openPromise: Promise<void> | null = null;
  private readQueue: Array<(d: Uint8Array | null) => void> = [];
  private buffer: Uint8Array = new Uint8Array(0);
  private connected = false;

  constructor(private readonly url: string) { }

  async connect(_: {
    host: string;
    port: number;
    secure: boolean;
    startTLS?: boolean;
    alpnProtocols?: string[];
  }): Promise<void> {
    // The IMAP host/port are configured on the gateway; we just connect to url.
    if (this.openPromise) return this.openPromise;
    this.openPromise = new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.binaryType = 'arraybuffer';
        this.ws.onopen = () => {
          this.connected = true;
          resolve();
        };
        this.ws.onmessage = (ev) => {
          const data = ev.data as ArrayBuffer;
          const chunk = new Uint8Array(data);
          if (this.readQueue.length) {
            const fn = this.readQueue.shift()!;
            fn(chunk);
          } else {
            const merged = new Uint8Array(this.buffer.length + chunk.length);
            merged.set(this.buffer, 0);
            merged.set(chunk, this.buffer.length);
            this.buffer = merged;
          }
        };
        this.ws.onerror = () => {
          if (!this.connected) reject(new Error('WebSocket error'));
          this.flushClose();
        };
        this.ws.onclose = () => {
          this.flushClose();
        };
      } catch (e) {
        reject(e);
      }
    });
    return this.openPromise;
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not open');
    }
    this.ws.send(data);
  }

  async read(): Promise<Uint8Array | null> {
    if (this.buffer.length > 0) {
      const out = this.buffer;
      this.buffer = new Uint8Array(0);
      return out;
    }
    return new Promise((resolve) => this.readQueue.push(resolve));
  }

  async close(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.flushClose();
  }

  isConnected(): boolean {
    return this.connected;
  }

  private flushClose() {
    this.connected = false;
    while (this.readQueue.length) this.readQueue.shift()!(null);
  }
}
