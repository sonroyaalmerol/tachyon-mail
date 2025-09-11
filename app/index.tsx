import { Platform } from 'react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { THEME } from '@/lib/theme';
import { Link, Stack } from 'expo-router';
import { MoonStarIcon, StarIcon, SunIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { Image, type ImageStyle, View } from 'react-native';

import { ImapClient } from '@/lib/mail/imap/ImapClient';
import type { Transport } from '@/lib/mail/core/Transport';
import { WebSocketTransport } from '@/lib/mail/transports/WebSocketTransport';
import { WebDavClient, CalDavClient, CardDavClient } from '@/lib/dav';

import TcpSocket from 'react-native-tcp-socket';
import { autoDiscoverDav } from '@/lib/dav/discovery/autoDiscoverDav';

function createImapTransport(): Transport {
  if (Platform.OS === 'web') {
    return new WebSocketTransport('wss://your-domain.com/imap-gateway');
  }
  return new RnTlsTransport();
}

class RnTlsTransport implements Transport {
  private socket: any | null = null;
  private connected = false;
  private readQueue: Array<(chunk: Uint8Array | null) => void> = [];
  private buffer: Uint8Array = new Uint8Array(0);

  async connect(params: {
    host: string;
    port: number;
    secure: boolean;
    startTLS?: boolean;
    alpnProtocols?: string[];
  }): Promise<void> {
    // For implicit TLS (IMAPS 993), TcpSocket.createConnection supports tls: true.
    // startTLS upgrade mid-connection is not directly supported by this lib.
    // For STARTTLS, prefer a gateway or a module that supports TLS upgrade.
    return new Promise((resolve, reject) => {
      try {
        this.socket = TcpSocket.createConnection(
          {
            host: params.host,
            port: params.port,
            tls: params.secure === true, // implicit TLS only
          },
          () => {
            this.connected = true;
            resolve();
          }
        );

        this.socket.on('data', (data: any) => {
          // data is ArrayBuffer or Buffer-like
          const chunk =
            data instanceof Uint8Array
              ? data
              : new Uint8Array(
                data.buffer || data, data.byteOffset || 0, data.length
              );
          if (this.readQueue.length) {
            const fn = this.readQueue.shift()!;
            fn(chunk);
          } else {
            // accumulate until someone reads
            const merged = new Uint8Array(this.buffer.length + chunk.length);
            merged.set(this.buffer, 0);
            merged.set(chunk, this.buffer.length);
            this.buffer = merged;
          }
        });

        this.socket.on('error', (err: any) => {
          if (!this.connected) reject(err);
          // Wake readers with null to indicate close/error
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

  async write(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('socket not connected'));
      this.socket.write(Buffer.from(data), (err: any) => {
        if (err) reject(err);
        else resolve();
      });
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
        this.socket.destroy();
      } catch { }
      this.socket = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// ===== End additions =====

const LOGO = {
  light: require('@/assets/images/react-native-reusables-light.png'),
  dark: require('@/assets/images/react-native-reusables-dark.png'),
};

const SCREEN_OPTIONS = {
  light: {
    title: 'React Native Reusables',
    headerTransparent: true,
    headerShadowVisible: true,
    headerStyle: { backgroundColor: THEME.light.background },
    headerRight: () => <ThemeToggle />,
  },
  dark: {
    title: 'React Native Reusables',
    headerTransparent: true,
    headerShadowVisible: true,
    headerStyle: { backgroundColor: THEME.dark.background },
    headerRight: () => <ThemeToggle />,
  },
};

const IMAGE_STYLE: ImageStyle = {
  height: 76,
  width: 76,
};

export default function Screen() {
  const { colorScheme } = useColorScheme();
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);

  const onTestImapLogin = React.useCallback(async () => {
    setBusy(true);
    setStatus('Connecting…');

    // TODO: replace these with your server and user credentials.
    const IMAP_HOST = 'imap.example.com';
    const IMAP_PORT = 993; // 993 for implicit TLS, 143 for plain/STARTTLS
    const USERNAME = 'user@example.com';
    const PASSWORD = 'your-password';

    // Choose LOGIN or PLAIN:
    const usePlain = false; // set true to use PLAIN instead of LOGIN

    const transport = createImapTransport();
    const imap = new ImapClient(transport, {
      host: IMAP_HOST,
      port: IMAP_PORT,
      secure: IMAP_PORT === 993, // implicit TLS if 993
      // startTLS: true, // only if using 143 and your transport supports upgrade
      auth: usePlain
        ? { mechanism: 'PLAIN', username: USERNAME, password: PASSWORD }
        : { mechanism: 'LOGIN', username: USERNAME, password: PASSWORD },
      commandTimeoutMs: 20000,
    });

    try {
      await imap.connect();
      setStatus('Connected. Selecting INBOX…');
      const sel = await imap.selectMailbox('INBOX');
      setStatus(`INBOX selected (exists: ${sel.exists}${sel.unseen ? `, unseen: ${sel.unseen}` : ''}). Running NOOP…`);
      // quick smoke test: search or noop
      await imap.search('ALL');
      setStatus('IMAP auth OK. Search succeeded.');
      await imap.close();
      setStatus('Closed connection. Success.');
    } catch (e: any) {
      const msg = String(e?.message || e);
      setStatus('IMAP error: ' + msg);
      try {
        await imap.close();
      } catch { }
    } finally {
      setBusy(false);
    }
  }, []);

  const onTestCalDav = React.useCallback(async () => {
    setBusy(true);
    setStatus("CalDAV: Auto-discovering…");

    const AUTH = { type: "basic" as const, username: "user", password: "pass" };
    const ORIGIN = "https://dav.example.com"; // domain only; no path

    try {
      const disco = await autoDiscoverDav({ origin: ORIGIN, auth: AUTH });

      if (!disco.caldavBase && !disco.calendarHomeHref) {
        setStatus("CalDAV: Could not discover service.");
        setBusy(false);
        return;
      }

      const dav = new WebDavClient({
        baseUrl: disco.caldavBase || disco.origin + "/",
        auth: AUTH,
        userAgent: "rn-dav-test/1.0",
        timeoutMs: 15000,
      });
      const cal = new CalDavClient(dav);

      // If home-set is known, list under it; else fall back to listCalendars()
      let calHref = disco.calendarHomeHref;
      if (!calHref) {
        const list = await cal.listCalendars("/");
        calHref = list[0]?.href;
      }
      if (!calHref) {
        setStatus("CalDAV: No calendars found after discovery.");
        setBusy(false);
        return;
      }

      const now = new Date();
      const start = new Date(now.getTime() - 7 * 86400000).toISOString();
      const end = new Date(now.getTime() + 7 * 86400000).toISOString();
      const items = await cal.timeRangeQuery(calHref, start, end);
      setStatus(`CalDAV OK. Found ${items.length} events in ±7d.`);
    } catch (e: any) {
      setStatus("CalDAV discovery error: " + String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }, []);

  const onTestCardDav = React.useCallback(async () => {
    setBusy(true);
    setStatus("CardDAV: Auto-discovering…");

    const AUTH = { type: "basic" as const, username: "user", password: "pass" };
    const ORIGIN = "https://dav.example.com";

    try {
      const disco = await autoDiscoverDav({ origin: ORIGIN, auth: AUTH });

      if (!disco.carddavBase && !disco.addressbookHomeHref) {
        setStatus("CardDAV: Could not discover service.");
        setBusy(false);
        return;
      }

      const dav = new WebDavClient({
        baseUrl: disco.carddavBase || disco.origin + "/",
        auth: AUTH,
        userAgent: "rn-dav-test/1.0",
        timeoutMs: 15000,
      });
      const card = new CardDavClient(dav);

      let bookHref = disco.addressbookHomeHref;
      if (!bookHref) {
        const books = await card.listAddressBooks("/");
        bookHref = books[0]?.href;
      }
      if (!bookHref) {
        setStatus("CardDAV: No address books found after discovery.");
        setBusy(false);
        return;
      }

      const multi = await card.multiGet(bookHref, [bookHref + "first.vcf"].slice(0, 0)); // placeholder
      setStatus(
        `CardDAV OK. Discovery succeeded. Home: ${bookHref}. Multiget size: ${multi.length}`
      );
    } catch (e: any) {
      setStatus("CardDAV discovery error: " + String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <>
      <Stack.Screen options={SCREEN_OPTIONS[colorScheme ?? 'light']} />
      <View className="flex-1 items-center justify-center gap-8 p-4">
        <Image
          source={LOGO[colorScheme ?? 'light']}
          style={IMAGE_STYLE}
          resizeMode="contain"
        />
        <View className="gap-2 p-4">
          <Text className="ios:text-foreground font-mono text-sm text-muted-foreground">
            1. Edit <Text variant="code">app/index.tsx</Text> to get started.
          </Text>
          <Text className="ios:text-foreground font-mono text-sm text-muted-foreground">
            2. Save to see your changes instantly.
          </Text>
        </View>

        <View className="gap-3 items-center w-full px-6">
          <Button onPress={onTestImapLogin} disabled={busy} className="w-full">
            <Text>{busy ? 'Testing IMAP…' : 'Test IMAP Login (LOGIN/PLAIN)'}</Text>
          </Button>

          <Button onPress={onTestCalDav} disabled={busy} className="w-full">
            <Text>{busy ? 'Testing CalDAV…' : 'Test CalDAV (list + query)'}</Text>
          </Button>

          <Button onPress={onTestCardDav} disabled={busy} className="w-full">
            <Text>{busy ? 'Testing CardDAV…' : 'Test CardDAV (list + multiget)'}</Text>
          </Button>

          {status ? (
            <Text className="font-mono text-sm text-muted-foreground text-center">
              {status}
            </Text>
          ) : null}
        </View>

        <View className="flex-row gap-2 mt-6">
          <Link href="https://reactnativereusables.com" asChild>
            <Button>
              <Text>Browse the Docs</Text>
            </Button>
          </Link>
          <Link href="https://github.com/founded-labs/react-native-reusables" asChild>
            <Button variant="ghost">
              <Text>Star the Repo</Text>
              <Icon as={StarIcon} />
            </Button>
          </Link>
        </View>
      </View>
    </>
  );
}

const THEME_ICONS = {
  light: SunIcon,
  dark: MoonStarIcon,
};

function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useColorScheme();

  return (
    <Button
      onPressIn={toggleColorScheme}
      size="icon"
      variant="ghost"
      className="rounded-full web:mx-4">
      <Icon as={THEME_ICONS[colorScheme ?? 'light']} className="size-5" />
    </Button>
  );
}
