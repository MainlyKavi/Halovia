# Halovia

**Protection that travels with you.**

Halovia is a mobile-first journey-safety prototype that lets users create journeys, choose trusted contacts, respond to safety check-ins, and access emergency actions from a simple interface.

> Halovia is currently a prototype. It does not provide real live tracking, send alerts, contact emergency services, or sync data between devices.

## Features

- Journey setup with destination, ETA, transport, and vehicle details
- Trusted contact management
- Simulated live journey and safety check-ins
- Emergency-action interface
- English, Hindi, and Spanish
- Pink, light, and dark themes
- Local browser storage
- Basic PWA and offline shell

## Tech Stack

- Next.js
- React
- TypeScript
- Vite
- Vinext
- Nitro

## Run Locally

```bash
git clone https://github.com/MainlyKavi/Halovia.git
cd Halovia
npm install
npm run dev
```

## Important Limitations

The current version uses simulated routes and alerts. User, contact, journey, and preference data is stored only in the browser using `localStorage`.

Halovia should not be relied on during a real emergency.

## Author

Created by [MainlyKavi](https://github.com/MainlyKavi).
