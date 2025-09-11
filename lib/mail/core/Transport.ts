export interface Transport {
  connect(params: {
    host: string;
    port: number;
    secure: boolean;
    startTLS?: boolean;
    alpnProtocols?: string[];
  }): Promise<void>;
  write(data: Uint8Array): Promise<void>;
  read(): Promise<Uint8Array | null>; // null = closed
  close(): Promise<void>;
  setReadMode?(mode: "raw" | "line"): void;
  isConnected(): boolean;
}

// Simple line reader over raw transport reads with backpressure.
export class LineReader {
  private buf: Uint8Array = new Uint8Array(0);
  private closed = false;

  constructor(private readonly t: Transport) { }

  isClosed(): boolean {
    return this.closed && this.buf.length === 0;
  }

  async readLine(): Promise<string | null> {
    for (; ;) {
      const idx = this.indexOfCRLF(this.buf);
      if (idx >= 0) {
        const line = this.decodeAscii(this.buf.subarray(0, idx));
        this.buf = this.buf.subarray(idx + 2);
        return line;
      }
      const chunk = await this.t.read();
      if (chunk == null) {
        this.closed = true;
        if (this.buf.length === 0) return null;
        const line = this.decodeAscii(this.buf);
        this.buf = new Uint8Array(0);
        return line;
      }
      this.buf = concat(this.buf, chunk);
    }
  }

  private indexOfCRLF(arr: Uint8Array): number {
    for (let i = 0; i + 1 < arr.length; i++) {
      if (arr[i] === 13 && arr[i + 1] === 10) return i;
    }
    return -1;
  }

  private decodeAscii(arr: Uint8Array): string {
    // Some RN engines don’t accept "ascii". Use utf-8 safely (IMAP lines are ASCII).
    return new TextDecoder("utf-8", { fatal: false }).decode(arr);
  }
}

export function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// A minimal in-memory backpressure-aware writer queue
export class Writer {
  private queue: Uint8Array[] = [];
  private writing = false;
  private closed = false;

  constructor(private readonly t: Transport) { }

  async write(data: Uint8Array): Promise<void> {
    if (this.closed) throw new Error("writer closed");
    this.queue.push(data);
    if (!this.writing) {
      this.writing = true;
      while (this.queue.length) {
        const chunk = this.queue.shift()!;
        await this.t.write(chunk);
      }
      this.writing = false;
    }
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}
