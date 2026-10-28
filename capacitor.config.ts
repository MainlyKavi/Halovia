import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.halovia.prototype",
  appName: "Halovia",
  webDir: "dist-mobile",
  backgroundColor: "#fff7f8",
  android: {
    // Android 15 draws apps edge to edge; keep the web view below the status bar.
    adjustMarginsForEdgeToEdge: "auto",
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_halovia",
      iconColor: "#ce6685",
    },
  },
};

export default config;
