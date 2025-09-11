# Tachyon Mail

Tachyon Mail is a modern, privacy‑respecting IMAP email client targeting iOS, Android, and the Web (via React Native Web). It aims to deliver a fast, streamlined, and robust experience for triage, reading, composing, and searching email using standard IMAP/SMTP backends.

Status: Not available yet. Tachyon Mail is under heavy development. APIs, features, and UI are actively changing. Do not use in production.

## About

- Cross‑platform: iOS, Android, and Web
- Standards‑based: IMAP/SMTP for mail; optional CalDAV/CardDAV integrations
- Security‑first: TLS by default, XOAUTH2 support, minimal permissions
- Performance‑oriented: efficient header fetching, on‑demand bodies, short‑lived connections for web constraints
- Minimal dependencies: tight control of transports, parsers, and memory usage

This project is built with:
- Expo + React Native
- Expo Router for navigation
- NativeWind + Tailwind for styling
- React Native Reusables for UI primitives

## Getting Started (Development)

Run the dev server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

This starts the Expo Dev Server. You can open the app in:
- iOS Simulator: press i (macOS only)
- Android Emulator: press a
- Web: press w

You can also scan the QR code with the Expo Go app to run on a physical device.

Note: For Web builds that directly connect to IMAP/SMTP or DAV endpoints, ensure your backend or proxy provides appropriate CORS headers. Mobile (native) builds are not subject to browser CORS.

## Development Focus

- Mail core
  - IMAP client with PLAIN/LOGIN/XOAUTH2 authentication
  - SMTP client for sending, with implicit TLS or STARTTLS
  - Efficient fetches (batched header queries, partial body fetches, IDLE where appropriate)
- Optional DAV
  - CalDAV/CardDAV clients via HTTP(S) fetch
  - Auto‑discovery for well‑known endpoints and home sets
- Transport Abstraction
  - Native TLS socket on iOS/Android
  - WebSocket gateway for IMAP/SMTP on Web
  - Direct fetch for DAV on all platforms
- Memory + Performance
  - Cap previews with byte limits
  - Avoid large in‑memory MIME or mailbox trees
  - Conditional requests with ETags/sync tokens for DAV

## Roadmap (Subject to Change)

- Core mail: search, labels/folders, flagging, threading, drafts
- Composer: rich text, attachments, inline images
- Caching: local envelope/body cache with background refresh
- Push/idle strategies per platform
- Advanced auth: token refresh hooks, account management
- CalDAV/CardDAV: opt‑in sync and quick summaries
- Accessibility, localization, theming

## Contributing

At this time the project is evolving rapidly. If you’re interested in contributing (testing transports, gateways, or providers), open an issue or PR with clear context. Please note breaking changes are expected until an initial beta.

## Security

- Uses TLS transports by default
- XOAUTH2 tokens supported; credentials are never logged
- For Web, configure a same‑origin reverse proxy or proper CORS on your IMAP/SMTP gateways and DAV endpoints

## License

TBD (will be added before public preview).

---

Tachyon Mail is not released yet. Follow this repository for updates as we progress toward an initial preview.
