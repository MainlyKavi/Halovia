# Halovia demo script (about 3 minutes)

**Before you start**

- Phone charged, media volume **up**, Do Not Disturb **off**.
- Wi-Fi or mobile data on (the map and live routes look best online; the demo also works offline with the saved route and places).
- Open Halovia → Settings → **Reset demo**. Demo mode should be on and cab speed **Fast**.
- Optional: open a second screen (laptop browser at `http://localhost:5174/?view=contact`) to show the contact's side live.

Each step below also has a **Run** button on the in-app **Demo script** screen (Home → "Open demo script") if you'd rather tap through.

---

### 0:00 — The problem (15 s)

> "When a woman takes a cab alone, the people who care about her can't see where she is or know when something goes wrong. Halovia fixes that."

Show the **Home** screen: "Connected with Rapido", the map, the HELP button, "Dad, Kavi +1 can view this journey" and the emergency helplines.

### 0:15 — Trusted group (20 s)

Tap the **Group** card on Home. Four people are already set up: Dad, Kavi, Niara and Milan.

> "You choose who you trust. You can add, edit or remove people here."

Optionally tap **Add member** to show the form, then cancel.

### 0:35 — The booked ride (25 s)

Tap the **settings gear → Rapido (demo)**. This is a generic, unbranded ride-app screen (labelled "Simulated demo screen"): the cab drives toward the pickup at Echelon, "Arriving in 2 mins".

> "This is the confirmation your cab app shows: driver, photo, car, number plate, fare. We can't integrate with Rapido, Ola or Uber without their APIs, so this is a mock behind a `RideProvider` interface. The real integration plugs in right here."

(Optional: the **Connected with Rapido** chip on Home opens the Halovia-styled booking card with a Rapido / Ola / Uber switch.)

### 1:00 — Share with Halovia (20 s)

Tap **Share with Halovia**. Halovia opens with the ride active, the toast "Journey shared with Dad, Kavi +1", and the group card "Dad, Kavi +1 can view this journey" (Dad, Kavi and Niara).

> "One tap, and her trusted people can follow the ride: live location, driver, plate and the full route."

### 1:20 — Live tracking (20 s)

The map shows the real road route, the cab moving, ETA, distance left, and **Sharing with 3 people**.

> "The route comes from OpenStreetMap. The cab movement is simulated for the demo."

### 1:40 — Wrong turn (25 s)

Tap **Simulate wrong turn**. Watch the chip change to "Off route by …". After a few seconds:

- the phone vibrates and chimes,
- a **Driver left the planned route** banner appears,
- a system notification arrives (this stands in for the contact's push).

> "If the cab stays more than 300 metres off the planned route for a few seconds, the group is alerted automatically, with the location, Police Station Bhupani (8.5 km) and Sarvodaya Hospital (15.6 km)."

Tap **I'm OK**.

### 2:05 — SOS (25 s)

Go to **Home**. **Press and hold** the HELP button for 2 seconds (or double-tap). Point out the fill bar and the **5-second cancel** countdown.

When it fires: full red screen, siren, strong vibration. It shows who was alerted and the nearest police station and hospital.

> "Hold-to-trigger avoids pocket presses, and there's a 5-second window to cancel. In demo mode no real call is placed."

### 2:30 — What the contact sees (25 s)

On the SOS screen, tap **Demo: switch to contact view** (or look at the second screen).

> "This is Kavi's phone." The alarm plays, and the SOS card shows with the number plate, the nearest police and hospital, and buttons to **Call Shreya**, **Call police 100/112** and **Open in Maps**.

Scroll to show the live map and the alert history, including the earlier route alert. Tap **Acknowledge**.

### 2:55 — Close (5 s)

Tap **Back to my view → I'm safe, stop SOS**.

> "Next steps: real ride-app partnerships, push notifications, a backend and an SMS fallback."

Afterwards: Settings → **Reset demo**.

---

**If something goes wrong:** Settings → Reset demo puts everything back. If the map is blank, the network is down; the route, cab and alerts still work on the plain background.
