# Sync Party 🎵

Turn every phone in a room into a synced speaker. One device is the master and controls playback; everyone else joins the room and plays the exact same audio in time.

## How it works
- The server keeps a "server clock" that every device syncs against (ping-pong, like a mini NTP).
- When the master hits play/seek, the server timestamps it 1–1.5s in the future and broadcasts that target time to everyone (including the master).
- Every device schedules `audio.play()` to fire at that exact future moment using its own clock offset — so all devices start within milliseconds of each other.
- While playing, the master pings its position every 3s. Listeners compare that to their own clock and nudge playback speed slightly (or hard-seek if drift gets big) to stay locked in sync.

## Setup

```bash
npm install
node server.js
```

Then open `http://localhost:3000` in a browser.

## Using it across multiple phones

The server needs to be reachable from every device, so:

1. Make sure your computer and all phones are on the **same Wi-Fi network**.
2. Find your computer's local IP address:
   - Mac/Linux: `ipconfig getifaddr en0` (or `hostname -I` on Linux)
   - Windows: `ipconfig` and look for IPv4 Address
3. On the master device, open `http://localhost:3000` and click **Create Room**.
4. On every other phone, open a browser and go to `http://YOUR_COMPUTER_IP:3000`, then enter the room code to join.
5. On the master, use the **search box** to find a song on Audius and tap Play — or paste a direct audio URL yourself (e.g. from Jamendo, or a file you host).

Note: mobile browsers block autoplay until a user interacts with the page — tapping "Join" on the listener page satisfies that requirement.

## Deploying (Netlify + a separate backend host)

Netlify only serves static files — it can't run the persistent WebSocket server that powers room sync. So the deploy is two parts:

**1. Backend (server.js) — needs a host that supports WebSockets:**
- [Render](https://render.com) — free tier, easiest: New → Web Service → connect repo (or upload) → build command `npm install`, start command `node server.js`.
- Railway, Fly.io, or Glitch also work well and have free/cheap tiers.
- Once deployed you'll get a URL like `https://sync-party-abcd.onrender.com`.

**2. Frontend (public/index.html) — Netlify:**
- Drag-and-drop the `public` folder (or this whole zip) onto [app.netlify.com/drop](https://app.netlify.com/drop).
- Netlify will give you a URL like `https://your-site.netlify.app`.
- Open it with a `?server=` param pointing at your backend host (no `https://`, no trailing slash):
  `https://your-site.netlify.app/?server=sync-party-abcd.onrender.com`
- Share that same link (with the `?server=...` part) with everyone joining the room.

If you don't want to split hosting, the simplest path is still: deploy the *whole* project (frontend + backend together) to Render/Railway/Glitch and skip Netlify entirely — then everyone just uses that one URL.


- This uses direct audio file URLs, not Spotify/YouTube Music — those platforms don't expose raw streams for third-party playback (see earlier discussion).
- Sync accuracy is typically within ~50–150ms depending on Wi-Fi latency — good enough that it sounds unified in a room, though not sample-perfect.
- If the master disconnects, the room closes and listeners are notified.

## Next ideas
- Persist rooms so people can rejoin after a refresh.
- Add per-device EQ/volume presets for a real "surround" effect based on where each phone is in the room.
