# Tachyon Mail

Tachyon Mail is a modern, privacy‑respecting webmail client. It runs entirely in the browser and supports Progressive Web App (PWA) installation for a native‑like experience. It connects to standard IMAP/SMTP backends via a secure web gateway.

Status: Not available yet. Tachyon Mail (Web) is under active development. APIs, features, and UI are changing. Do not use in production.

## About

- Web‑only: runs in any modern browser
- PWA‑ready: installable, offline‑aware UI, app icon, splash, theming
- Standards‑based: IMAP/SMTP over a secure WebSocket/HTTP gateway
- Security‑first: TLS by default, XOAUTH2 support, minimal permissions
- Performance‑oriented: efficient header fetching, on‑demand bodies

## Roadmap (Subject to Change)

- Core mail: search, folders/labels, flags, threading, drafts
- Composer: rich text, attachments, inline images
- Caching: local envelope/body cache with background refresh
- Push/idle strategies via gateway
- Advanced auth: OAuth flows, token refresh, multi‑account
- Accessibility, localization, theming
- Enhanced PWA offline behaviors (safe read‑only modes, queued send)

## Contributing

The project is evolving rapidly. If you’re interested in testing the web transport, gateways, or providers, open an issue or PR with clear context. Breaking changes are expected until an initial beta.

## Security

- TLS by default (HTTPS/WSS)
- XOAUTH2 tokens supported; secrets are never logged
- Strongly recommended: same‑origin gateway to simplify CORS and cookies
- If cross‑origin, configure strict CORS and secure cookies

## License

TBD (will be added before public preview).

---

Tachyon Mail is not released yet. Follow this repository for updates as we progress toward an initial preview.
