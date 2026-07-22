# Halovia real-device test matrix

Record evidence for every row before calling a pilot production-ready.

| Area | Owner device | Viewer device | Expected evidence |
| --- | --- | --- | --- |
| Authentication | Sign in, refresh, sign out, expired session | Not required for token view | Owner APIs reject missing identity; viewer cannot mutate |
| Location | Allow, deny, revoke, timeout, poor accuracy | N/A | One watcher only; exact status and cleanup |
| Movement | Walk/drive with app open | Watch active token | Genuine positions, timestamp, accuracy, no fake points |
| Network | Offline then reconnect | Offline then reconnect | Owner queue ≤5; newest relevant point; viewer stale label |
| Background | Lock, app switch, battery saver, close tab | Observe last update | No live label after 45 seconds; limitation remains visible |
| Sharing | Create, copy/share sheet, revoke, regenerate | Open valid/expired/revoked token | No claim of delivery; no PII in URL; access ends correctly |
| Safety | Safe, help, extend once, allow timeout | Observe each transition | Server timestamps and timeline; no claim of SMS/call/dispatch |
| Journey end | End and arrive safely | Keep viewer open | Watcher/writes stop; token loses access; one history row |
| Vehicle image | JPEG/PNG/WebP, oversize, HEIC | Open shared image | Validation, private retrieval, deletion with account/journey |
| Locales | en/hi/ur/bn/ta/ar at 320–390 px | Same | RTL, no clipping/overflow, focus and touch targets |
| PWA | Install, `/launch`, offline page, update | Open browser link | Correct route resolver; no private API/viewer caching |

Browsers to include: current Chrome Android, Safari iOS, Chrome desktop, Safari desktop, and Edge desktop where available. Capture versions, operating systems, permission settings, battery mode, and network conditions with the results.
