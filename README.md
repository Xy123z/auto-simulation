# Vision — Auto-Simulation

A voice-driven conversational front end for Vision's 3D robot rig. Unlike the
sibling `compiler` project (a DSL that gets *compiled* ahead of time into a
fixed instruction list), this project has **no compiler at all** — it's a
live loop:

```
   mic 🎙️            fetch()            LLM endpoint
 ──────────►  text ──────────►  /api/chat ──────────►  (OpenAI-compatible
  (Web Speech)                    (Node)                or Anthropic)
                                     │
                                     ▼
                        safelisted, clamped commands
                                     │
                                     ▼
                     3D rig animation  +  spoken reply (TTS)
```

## Important: run the server, don't open the HTML file

`client/index.html` must be loaded via **`http://localhost:8787`**, not by
double-clicking the file. Every fetch in the app (`/api/chat`, `/api/health`,
`/assets/model/robot.obj`) uses an absolute path that only resolves against
the Node server — opened as `file://`, the model won't load and you'll see a
cluster of console errors. The app itself detects this and shows a banner
telling you so, rather than failing silently.

## What it does

- **Mic-only interface, on purpose** — there's no persistent chat log. What
  you say and what Vision replies both appear as a caption over the 3D view
  that fades after a few seconds, then it's gone. A small keyboard icon
  reveals a one-line text fallback if you'd rather type, or if your browser
  doesn't support speech recognition (it appears automatically in that case).
- **Listens** continuously through the browser's microphone (Web Speech API)
  and transcribes speech to text client-side — no audio ever leaves the
  browser as audio; only the recognized text is sent to the server.
- **While you're mid-sentence**, the robot gives a small "I'm listening"
  reaction — its eyes nudge back and forth — purely client-side, before your
  utterance even finishes.
- **Wake-word fast path**: short imperative phrases starting with "Vision"
  (e.g. *"Vision, dance"*, *"Vision, turn left"*, *"Vision, emergency stop"*)
  are matched instantly on the server with a regex and never touch the LLM —
  same instant reaction every time.
- **Everything else** goes to an LLM you configure. Vision's system prompt
  tells the model it may embed movement tags like `[[CMD:DANCE 2500]]`
  in its reply; the server strips those tags out, validates every one against
  a fixed command safelist (with clamped numeric ranges), and only forwards
  what survives to the browser. An LLM can never send an arbitrary command —
  only entries from `COMMAND_TYPES` in `server/src/types.ts` are recognized,
  and each one is bounds-checked before it ever reaches the 3D rig.
- **Speaks and moves at the same time** — the reply is spoken with
  `speechSynthesis` while the validated command sequence plays out on the
  rig, the way a real assistant gestures while it talks.
- The 3D rig itself (Three.js, r128, loaded from cdnjs) is the same
  parse-the-OBJ-by-hand engine and `setEyeAngle` / `setBodyTurn` /
  `setWalking` / `setDancing` / `setStopped` API used in the compiler
  project's simulator — same model asset, same look.

## Project layout

```
vision-auto-simulation/
├── server/src/
│   ├── env.ts        zero-dependency .env loader (must import first)
│   ├── types.ts       COMMAND_TYPES safelist + shared types
│   ├── commands.ts    wake-word matcher + LLM command-tag extraction/validation
│   ├── llm.ts         provider-agnostic LLM client (OpenAI-compatible or Anthropic)
│   ├── chat.ts        orchestrates direct-command vs LLM path
│   └── server.ts      plain node:http server — static files + /api/chat + /api/health
├── client/
│   ├── index.html      layout: 3D stage + chat/mic panel
│   ├── css/style.css
│   ├── js/
│   │   ├── rig.js       Three.js robot rig (ported from the simulator)
│   │   ├── speech.js     SpeechRecognition + speechSynthesis wrapper
│   │   └── client.js     wiring: mic → /api/chat → speak + animate
│   └── assets/
│       ├── model/robot.obj
│       └── logo/Vision.png
├── package.json
├── tsconfig.json
└── .env.example
```

The server has **zero runtime npm dependencies** — it's built entirely on
Node's built-in `http`, `fs`, `path`, and global `fetch`. `tsx` and
`typescript` are dev-only, used to run/build the TypeScript.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` and set:

```
LLM_PROVIDER=openai        # or "anthropic"
LLM_API_KEY=sk-...
# LLM_MODEL=gpt-4o-mini    # optional override
# LLM_API_URL=...          # optional — point at a local OpenAI-compatible
                            # server (Ollama, LM Studio, etc.) if you like
```

You can skip this entirely and the app still runs: wake-word commands work
with no key at all, and open-ended questions just get a friendly "no brain
plugged in yet" reply until you add one.

```bash
npm start          # http://localhost:8787
```

Open it in **Chrome or Edge** (best Web Speech API support), click the mic
button, allow microphone access, and talk. There's also a text box if you'd
rather type, or if your browser doesn't support speech recognition.

## Try it

- "Vision, dance" → instant reaction, no LLM call.
- "Vision, turn left" / "turn right" / "walk forward" / "emergency stop".
- Anything else ("What's your favorite color?", "Can you wave hello?") goes
  to the LLM, which may choose to move as part of its reply.

## Notes on safety and scope

This is a browser demo, not a real robot controller — but the validation
habit is deliberate and mirrors the sibling compiler project's philosophy:
**nothing from an LLM (or a spoken phrase) reaches the animation layer
without passing through a fixed safelist and numeric clamps first.** See
`server/src/commands.ts` for both the wake-word patterns and the
`extractCommands()` validator.

`npm run build` type-checks and compiles the server to `dist/` (requires
`@types/node`, pulled in by `npm install`); `npm run dev` runs it with
auto-restart on save.
