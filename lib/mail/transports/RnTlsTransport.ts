import TcpSocket, {
  type TLSSocket,
  type Socket as RNSocket,
} from 'react-native-tcp-socket';

type TLSOptions = {
  // Ensure SNI and validation:
  host?: string; // same as 'servername' in some libs
  servername?: string;
  ca?: string | string[] | Buffer | Buffer[];
  cert?: string | Buffer;
  key?: string | Buffer;
  rejectUnauthorized?: boolean; // true in production
  alpnProtocols?: string[]; // e.g., ['imap']
};

class RnTlsTransport implements Transport {
  private socket: RNSocket | TLSSocket | null = null;
  private connected = false;
  private readQueue: Array<(chunk: Uint8Array | null) => void> = [];
  private buffer: Uint8Array = new Uint8Array(0);
  private currentHost?: string;
  private startTlsRequested = false;

  async connect(params: {
    host: string;
    port: number;
    secure: boolean;
    startTLS?: boolean;
    alpnProtocols?: string[];
    // optional TLS options
    caPem?: string | string[];
    rejectUnauthorized?: boolean;
  }): Promise<void> {
    this.currentHost = params.host;
    const tlsDirect = params.secure === true && params.startTLS !== true;

    return new Promise((resolve, reject) => {
      try {
        this.socket = TcpSocket.createConnection(
          {
            host: params.host,
            port: params.port,
            tls: tlsDirect, // implicit TLS only when secure=true and not STARTTLS
          },
          () => {
            this.connected = true;
            resolve();
          }
        );

        this.socket.on('data', (data: any) => {
          const chunk = toU8(data);
          if (this.readQueue.length) {
            const fn = this.readQueue.shift()!;
            fn(chunk);
          } else {
            const merged = new Uint8Array(this.buffer.length + chunk.length);
            merged.set(this.buffer, 0);
            merged.set(chunk, this.buffer.length);
            this.buffer = merged;
          }
        });

        this.socket.on('error', (err: any) => {
          if (!this.connected) reject(err);
          while (this.readQueue.length) this.readQueue.shift()!(null);
        });

        this.socket.on('close', () => {
          this.connected = false;
          while (this.readQueue.length) this.readQueue.shift()!(null);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  // Upgrade the existing TCP connection to TLS (for STARTTLS)
  async startTLS(options?: TLSOptions): Promise<void> {
    if (!this.socket) throw new Error('socket not connected');
    if ((this.socket as any).encrypted) return; // already TLS
    const servername = options?.servername || this.currentHost;

    // react-native-tcp-socket provides startTLS on the socket
    return new Promise((resolve, reject) => {
      try {
        const tlsOpts: any = {
          host: this.currentHost,
          servername,
          rejectUnauthorized: options?.rejectUnauthorized ?? true,
        };
        if (options?.alpnProtocols) tlsOpts.alpnProtocols = options.alpnProtocols;
        if (options?.ca) tlsOpts.ca = options.ca;
        if (options?.cert) tlsOpts.cert = options.cert;
        if (options?.key) tlsOpts.key = options.key;

        // Replace underlying socket with the TLS-wrapped one
        (this.socket as any).startTLS(tlsOpts, (err: any, tlsSocket: TLSSocket) => {
          if (err) {
            reject(err);
            return;
          }
          this.rewireSocketEvents(tlsSocket);
          this.socket = tlsSocket;
          resolve();
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  private rewireSocketEvents(nextSocket: RNSocket | TLSSocket) {
    // Remove old listeners and reattach on the new socket
    // Simplest approach: clear queues and rebind
    nextSocket.on('data', (data: any) => {
      const chunk = toU8(data);
      if (this.readQueue.length) {
        const fn = this.readQueue.shift()!;
        fn(chunk);
      } else {
        const merged = new Uint8Array(this.buffer.length + chunk.length);
        merged.set(this.buffer, 0);
        merged.set(chunk, this.buffer.length);
        this.buffer = merged;
      }
    });
    nextSocket.on('error', (err: any) => {
      while (this.readQueue.length) this.readQueue.shift()!(null);
    });
    nextSocket.on('close', () => {
      this.connected = false;
      while (this.readQueue.length) this.readQueue.shift()!(null);
    });
  }

  async write(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('socket not connected'));
      const g: any = globalThis as any;
      if (g.Buffer) {
        (this.socket as any).write(g.Buffer.from(data), (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        const b64 = u8ToBase64(data);
        (this.socket as any).write(b64, 'base64', (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      }
    });
  }

  async read(): Promise<Uint8Array | null> {
    if (this.buffer.length > 0) {
      const out = this.buffer;
      this.buffer = new Uint8Array(0);
      return out;
    }
    return new Promise((resolve) => {
      this.readQueue.push(resolve);
    });
  }

  async close(): Promise<void> {
    if (this.socket) {
      try {
        (this.socket as any).destroy();
      } catch { }
      this.socket = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// keep your toU8/u8ToBase64/base64ToU8 helpers as-is
