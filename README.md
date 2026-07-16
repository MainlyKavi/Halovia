# Halovia v1

Halovia is a polished, mobile-first journey-safety prototype. It lets a user share an active trip with selected trusted contacts, respond to calm safety check-ins, review journey history, and quickly open emergency actions.

The prototype is intentionally local-first. It does not use a backend, send real alerts, dispatch emergency services, or promise live tracking without connectivity.

## Run locally

```bash
npm install
npm run dev
```

Open the local address shown in the terminal. A production build can be created with:

```bash
npm run build
```

## Included experience

- Responsive landing page and eight-step onboarding
- English, Hindi, and Spanish interface switching without reloads
- Light, dark, and pink themes saved to local storage
- Active and idle home states
- Three-step journey setup with optional vehicle details and image preview
- Active journey screen with a lightweight custom route preview
- Simulated unusual-activity safety check with countdown
- Confirmed prototype emergency actions
- Trusted-circle add, edit, pause, default, and emergency preferences
- Journey history and detail timelines
- Privacy, accessibility, notification, location, data, and profile settings
- Installable PWA metadata and a basic offline app shell

## Project structure

```text
app/                    App Router pages, metadata, and global theme styles
components/app/         App shell, shared journey UI, and route views
components/landing/     Marketing landing page
components/onboarding/  Onboarding flow
components/ui/          Reusable controls and brand components
lib/i18n/               Translation dictionaries
lib/                    Data interfaces and realistic prototype data
public/                 PWA manifest, icon, and service worker
```

## Prototype data and future backend

All user, contact, journey, theme, language, emergency, and privacy data is persisted under a versioned local-storage key. Data contracts are defined in `lib/types.ts`, while state mutations are isolated in `components/app/AppProvider.tsx`. This keeps the UI independent from persistence and makes it straightforward to replace local storage with Supabase or another backend later.

## Accessibility and privacy

Halovia uses semantic controls, visible focus styles, large touch targets, labelled dialogs, non-colour status cues, responsive type, reduced-motion support, and high-contrast theme tokens. Location is described and used only for an active journey. Clearing local data and ending a journey remain visible actions.

Halovia is currently a prototype and should not replace local emergency services.
