# AI Recording Beautiful Demos of a React Native App — Research

> **Question:** How can AI record beautiful demos of a React Native (Expo) app like Subby?
> **Date:** 2026-09-02 | **Expo SDK target:** 57 | **Primary sources only** — every claim cites the docs/code/spec that owns it.

---

## TL;DR — Three distinct jobs people mean by "AI recording demos"

| Job | What AI does | What stays human | Best fit for Subby today |
|-----|--------------|------------------|--------------------------|
| **A. Drive the real app** (AI taps/scrolls) + **record the simulator** | Maestro/MCP agent performs the flow deterministically | You pick the flow & polish the video | Reproducible, pixel-true demos — `docs/demo/*.mp4` v2 |
| **B. Beautify the capture** (frames, zoom, captions, music) | Auto-zoom, device frames, backgrounds, transcripts | You record once (or AI drives in A) | Store previews & Product Hunt/landing hero |
| **C. Synthesize video without running the app** (code → MP4) | AI scans codebase, generates Remotion/Tailwind scenes, renders H.264 | You answer creative prompts | App Store preview videos (15–30 s) when you don't want to re-record every release |

Subby already does a primitive A+B hybrid: raw simulator captures → `docs/demo/web/*.mp4` with posters, served via `docs/demo/index.html`. The research below upgrades that into a reproducible, beautiful pipeline.

---

## 1. Driving the Real App with AI (Deterministic, Re-runnable)

### 1.1 Maestro — the standard for React Native Expo E2E

- **What it is:** Maestro "provides full support for React Native applications on both Android and iOS. By operating at the accessibility layer, Maestro enables cross-platform testing with a single test suite, requiring zero instrumentation or modifications to your JavaScript/TypeScript source code." Source: [Maestro docs — React Native support](https://docs.maestro.dev/get-started/supported-platform/react-native)
- **Zero deps:** "You don't need to install any npm packages (like Detox or Appium drivers) inside your app. Maestro tests the final bundled binary." Same source.
- **Expo/EAS ready:** "Full compatibility with Expo Go, development builds, and EAS Workflows" — same source.
- **How it records:** Maestro flows support `startRecording` / `stopRecording` (wraps the run in an MP4) and `takeScreenshot` at checkpoints. The Pokedex guide shows the canonical pattern:
  ```yaml
  onFlowStart:
    - runFlow: ../common/setup.yaml
    - startRecording: recording-pokemon-lookup-journey
  # ... asserts, tapOn, inputText, swipe ...
  onFlowComplete:
    - stopRecording
  ```
  Source: [Maestro — Pokedex E2E Part 2](https://maestro.dev/blog/pokedex-ui-testing-series-a-guide-to-end-to-end-react-native-testing-with-maestro-part-2) (journey + subflows pattern)

- **Best selector:** `testID` — "best practice is to use the `testID` property, which Maestro maps to" native ids; text selectors break on i18n. Source: [Maestro React Native docs](https://docs.maestro.dev/get-started/supported-platform/react-native)
- **Maestro Cloud + EAS Workflows:** `type: maestro` jobs run flows against an `.apk` / `.app` simulator build in CI, with parallel Android+iOS, recordings, and JUnit. Source: [Expo docs — Run E2E tests with Maestro on EAS Workflows](https://docs.expo.dev/tutorial/cicd/e2e-tests/) and [Expo — E2E on EAS Workflows (examples)](https://docs.expo.dev/eas/workflows/examples/e2e-tests/)

**Subby relevance:** Subby already has `scripts/maestro/` (per `.opencode/AGENTS.md`). Those flows are the AI-readable spec for every demo. Add `startRecording` + `takeScreenshot` to existing flows and `maestro test` yields both pass/fail and demo artifacts.

### 1.2 Maestro MCP — let Claude Code / Cursor / any agent drive the simulator

- **What it is:** "Maestro implements the Model Context Protocol (MCP), enabling direct integration [with] coding agents like Claude Code, Claude Desktop, Cursor, GitHub Copilot, Codex …" Source: [Maestro — MCP docs](https://docs.maestro.dev/get-started/maestro-mcp)
- **Install:** `claude mcp add maestro -- maestro mcp` (ships inside Maestro CLI, so upgrading CLI upgrades the MCP). Source: same.
- **Tools exposed:** `list_devices`, hierarchy viewer, `run` (inline YAML / files / dir), plus viewer that embeds the simulator in the agent. Source: same.
- **Agentic demo proof:** `mobile-dev-inc/counter-app-demo` — "Every part of this project — the app code, the Maestro E2E tests, and the `CLAUDE.md` — was written by the AI agent … Each feature was implemented from a plain-English request, then validated by driving the actual UI through the Maestro MCP." Source: [mobile-dev-inc/counter-app-demo README](https://github.com/mobile-dev-inc/counter-app-demo)

- **Broader ecosystem:** 
  - `DaveDev42/expo-mcp` — session-based Expo+MCP bridge (`start_session` launches Expo, binds device, lease TTL; tools: `take_screenshot`, `tap_on`, `run_maestro_flow`, …). Source: [DaveDev42/expo-mcp README](https://github.com/DaveDev42/expo-mcp)
  - `vasiliydumanov/rn-mcp` — unified MCP that routes to Detox/Maestro/Expo best backend. Source: [vasiliydumanov/rn-mcp README](https://github.com/vasiliydumanov/rn-mcp)
  - `slapglif/maestro-mcp` — 47-tool MCP covering Maestro CLI. Source: [slapglif/maestro-mcp README](https://github.com/slapglif/maestro-mcp)
  - Expo's own MCP: `https://mcp.expo.dev/mcp` — local capabilities (`automation_take_screenshot`, `automation_tap`, `automation_find_view`, EAS workflows, etc.). Source: [Expo MCP docs](https://docs.expo.dev/mcp/)

**For Subby:** Install Maestro MCP (`maestro mcp`) and tell the agent: *"drive Subby's dashboard → add-subscription → subscriptions list on iOS simulator and record it."* The agent writes YAML, runs it, self-corrects on failure, and keeps the flow as CI artifact.

### 1.3 EAS Simulator (remote) — when there's no local Mac

- **What it is:** "EAS Simulator runs a remote iOS simulator or Android emulator on EAS infrastructure that you drive from your machine — from the CLI, from an AI agent (via `agent-device`), and from a browser preview." Source: [expo/skills — eas-simulator SKILL.md](https://github.com/expo/skills/blob/main/plugins/expo/skills/eas-simulator/SKILL.md)
- **Session lifecycle:** `simulator:start --platform ios --type agent-device --name "..."` → `simulator:exec npx agent-device@latest install/open/screenshot/record` → `simulator:stop`. The `--type agent-device` session emits both agent control and a `webPreviewUrl` (iOS). Source: same skill + [run-your-app.md reference](https://github.com/expo/skills/blob/HEAD/plugins/expo/skills/eas-simulator/references/run-your-app.md)
- **Drive verbs:** `press @e1`, `fill "text"`, `screenshot ./shot.png`, `record start / stop` (motion at ~30 fps). Source: same skill.
- **Live-edit mode (Mode C):** dev build + Metro tunnel v2 so code edits Fast-Refresh onto the remote sim before screenshotting. Source: [run-your-app.md](https://github.com/expo/skills/blob/HEAD/plugins/expo/skills/eas-simulator/references/run-your-app.md)

**Subby relevance:** Useful for CI or cloud agents (Linux CI, Cursor Cloud) where no local simulator exists; otherwise prefer local sim for speed/cost.

### 1.4 Other drivers (mentioned for completeness)

- **Detox / Appium / Expo MCP local automation** exist but Maestro+MCP is the lowest-friction for Expo 57 (no instrumentation, YAML flows, MCP-native). Detox is covered as a backend in `rn-mcp` but not recommended as primary for Subby's demo use case.

---

## 2. Making the Capture Beautiful (Device Frames, Zoom, Captions, Audio)

This is the "beautiful" half — independent of who drove the app.

### 2.1 Screen Studio (macOS) — the reference

- **Product:** "Screen recorder for macOS. Create engaging product demos, courses, tutorial and social media videos. Add automatic zoom on mouse actions, smooth mouse movement, and other powerful effects." Source: [screen.studio](https://screen.studio/)
- **Demo-specific:** "make product demo videos, saas demo recording" — dedicated guide. Source: [screen.studio — Product demo videos](https://screen.studio/create/product-demo-videos)
- **Features:** Automatic zoom on main actions, exports adjust for vertical mode, record screen+webcam+mic+system audio, webcam overlay auto-avoids cursor, audio normalization + noise removal, on-device transcript & subtitles (no raw media sent), iPhone/iPad recording via USB with device frames, up to 4K 60 fps + optimized GIFs. Source: [screen.studio](https://screen.studio/) feature list.

### 2.2 Screenify Studio (macOS)

- **Positioning:** "Cinematic screen recorder + mockup studio" with "30+ cinematic camera templates with multi-keyframe support. Dolly, pan-tilt, orbit, crane." Source: [Screenify Studio](https://www.screenify.studio/)
- **App Store angle:** "Capture the Simulator or a real iPhone — Photo-real frames that track your 3D camera — One-click App Store spec — 15–30s, 30fps." "Zero-bezel · 47 device frames · Dynamic Island." Source: same.
- **AI:** On-device captions/translation/background removal via Apple Neural Engine; free tier at 1080p with watermark, Pro removes watermark + 4K + AI. Source: same comparison table.
- **Differentiator vs Screen Studio:** "30+ 3D camera templates (Screen Studio has 2D zoom only), callout effects combining zoom + dim + glow + 3D, and 100% on-device AI." Source: same FAQ.

### 2.3 Screenfully (macOS app), Screenhance Studio (browser), Presenta (browser), Screen Charm (macOS)

- **Screenfully:** "Record your screen, apply templates, and export polished app demos … Templates, frames, backgrounds, 9:41 status bars, custom device frames, 4K/60fps export." Source: [Screenfully](https://screenfully.app/)
- **Screenhance Studio:** "Record your app in the browser, click to zoom into the feature that matters, frame it in a real device, and export a demo video … No download, works on macOS, Windows, Linux … Studio's click-to-place zoom … Real device and window frames … exports as MP4/WebM/GIF." Source: [Screenhance — App Demo Video Maker](https://screenhance.com/app-demo-video-maker)
- **Presenta:** Browser-based, "Professional Device Frames & Animations" — "Human-Touch" scroll simulation, 4K 60fps WebM/MP4, "privacy-first local processing" in Vanilla JS. Source: [Presenta](https://presenta-studio.vercel.app/)
- **Screen Charm:** "Cinematic by Default — automatically smooths cursor, applies smart zoom, wraps in device frames/backgrounds, 4K export, transcript generation." Source: [Screen Charm via AIToolly](https://aitoolly.com/product/screen-charm)

### 2.4 fastlane snapshot + frameit — the programmatic frame pipeline

- **snapshot:** Automates iOS screenshots via UI Tests — "Capture hundreds of screenshots in multiple languages on all simulators … concurrently … Generate a beautiful web page." Source: [fastlane — Screenshots docs](https://docs.fastlane.tools/getting-started/ios/screenshots/)
- **frameit:** "Put your screenshots into device frames with custom text and backgrounds … supports portrait/landscape … white/silver devices … background color + text." Requires `fastlane frameit download_frames` + `Framefile.json`. Source: [fastlane — frameit tools page](https://fastlane-fastlane.mintlify.app/tools/frameit)
- **Skill that wires Maestro→frameit:** `ntgussoni/app-store-play-store-screenshots-skill` — five phases: Discover (`app/` dir) → Plan (headlines) → Capture (Maestro on sim/emulator) → Frame (`fastlane frameit`) → Compose (gradient backgrounds, glow, particles) → Export (exact store dimensions). Requires Maestro + fastlane + Xcode + Android SDK. Source: [ntgussoni/app-store-play-store-screenshots-skill README](https://github.com/ntgussoni/app-store-play-store-screenshots-skill)

**Recommendation for Subby:** For hand-polished output, Screen Studio (or Screenify for 3D) is the 1-tool answer: record the simulator window, auto-zoom, wrap in iPhone frame, add gradient matching Subby's `#0B0F14`/`#22D3EE`, export MP4+GIF. For reproducible CI framing, use fastlane frameit (free, scriptable, matches the skill above).

---

## 3. Synthesizing Video Without Running the App (AI-Generated, Code-Driven)

These don't capture pixels — they render video from code/templates. Good for store previews that must be 15–30 s, H.264, exact dimensions.

### 3.1 Appshot — Remotion + Tailwind + AI creative director

- **What it does:** "Generate polished App Store preview videos, Google Play preview videos, and website demo videos — from your codebase, not a video editor. Built on Remotion + React + Tailwind. Ships with AI agent skills for Claude Code." Source: [trunghaiy/appshot README](https://github.com/trunghaiy/appshot)
- **AI skill flow:**
  1. Install skills into mobile app project
  2. Ask agent: "Generate App Store and Play Store preview videos"
  3. Skill scans codebase — extracts app name, brand colors, icon, features
  4. You answer creative questions (problem, core action, proof)
  5. Skill generates custom `.tsx` scenes using Appshot primitives → Remotion composition
  6. `npm run dev` preview, `npm run build` → MP4
  Source: same README.
- **Platform support:** "Supports React Native / Expo, Flutter, Swift (iOS), and Kotlin/Java (Android) for mobile, plus Next.js … for web." Source: same.
- **Store spec:** iPhone 6.7" `886×1920`, 15–30 s, H.264; Google Play `886×1920`; iPad variations. Default `886×1920` canvas works for both App Store + Play. Source: same "Store Requirements" table.
- **No-template approach:** "The AI skill generates custom `.tsx` scene files for each project — no fixed scene templates." Source: same.
- **Also:** `appshot-images` skill for screenshots; `appshot-web-videos` for `1920×1080` browser-mockup landing videos. Source: same skill table.

**Verdict for Subby:** Strongest AI-native path to App Store preview videos. Scan would pick up Subby's cyan `#22D3EE`, dark `#0B0F14`, subscription domain, and generate a 15–30 s narrative without manual editing.

### 3.2 expo-appstore-shots — screenshots from your real Expo screens, headless

- **Core idea:** "App Store screenshots rendered from your Expo app's own code — no Mac, no simulator, no mock-ups … It runs your real screens in a headless browser — `react-native` aliased to `react-native-web`, native modules stubbed, backend replaced by seeded fixtures — photographs them, and wraps each shot in a store frame." Source: [tranmani/expo-appstore-shots README](https://github.com/tranmani/expo-appstore-shots)
- **Video:** "Each preview loads the real screen, eases through its content on a deterministic curve, and captures device-pixel frames that a bundled ffmpeg encodes to the exact App Store spec — H.264, yuv420p, 15–30 s, 30 fps." Silent (doubles as YouTube/Play preview). `ffprobe` verifies before trusting. Source: same.
- **AI agent hook:** `See AGENTS.md — a step-by-step procedure for setting this up in an unfamiliar repo, including how to discover the screens, what to seed, and how to check the result.` Agent "reads the app, then comes back and asks what the set should say — which screens, in what order, what the captions argue." Source: same "For AI agents" section.
- **Config shape:** `projectRoot`, `rootLayout`, `setup`, `screens[]`, `tabBar`, `runtime` (coords/locale/timezone/clock/storage), `api.fixtures`, `devices`, `frame.grounds`, `slides[]` (headline/sub per screen). Source: same README config example.
- **Coverage:** expo-router (Stack + native tabs) and React Navigation; Reanimated 3/4, Gesture Handler, FlashList, Skia, expo-sqlite stubbed ("answers no rows — seed it"), etc. Needs Node 20 + Chromium (`npx playwright install chromium`). Source: same "Works with" list.

**Verdict for Subby:** Most truthful to Subby's real UI — renders `src/app/(tabs)/` etc. directly, so screenshots never drift. Best when you want store screenshots that *are* the app, not an illustration. Needs fixture seeding for `expo-sqlite` / Supabase.

### 3.3 aidemo — deterministic narrated demos from a storyboard

- **Tagline:** "AI Demo Engine — turn a storyboard into a narrated, captioned product demo video … Tell your coding agent 'record a 45s demo of the checkout flow' — get back a polished MP4 with voiceover, synced captions, and auto-zoom. Any MCP-capable agent writes one `storyboard.json`; the headless engine drives a real Chrome, records a deterministic replay, voices it, captions it, and trims the dead time." Source: [tandryukha/aidemo — npm](https://www.npmjs.com/package/@tandryukha/aidemo) / [aidemo README](https://github.com/tandryukha/aidemo)
- **Pipeline:** `storyboard.json → voice (OpenAI/ElevenLabs/local TTS → narration.mp3) → record (drives Chrome with animated cursor → raw webm + timeline.json) → captions (Whisper → srt/vtt) → compose (trim idle · sync · auto-zoom · cards · caption · mux → final-demo.mp4)` — each step re-runnable. Source: same.
- **Deterministic + CI:** "Because the replay is deterministic, the demo re-renders itself in CI when the product changes — no re-recording … about $0 a render" on free runner minutes with local voice. GitHub Action `uses: tandryukha/aidemo@stable`. Source: same.
- **Install:** Claude Code plugin `/plugin marketplace add tandryukha/aidemo`, or `npx -y github:tandryukha/aidemo#stable repo-init` for Codex/Gemini, or `AIDEMO_TTS_PROVIDER=local aidemo render --headless` fully offline (~$0, no API key). Source: same.
- **Polish is compose-time:** "Cinematic polish is compose-time, not record-time — a bad zoom is a recompose, never a re-record." Source: same POLISH doc reference.

**Verdict for Subby:** Best for *web* landing demo (Subby's `prototype-landing.html` / `site/`), not the native app — it drives Chrome, not the iOS simulator. Use it to auto-regenerate the marketing-site hero video in CI. For the native app, prefer Maestro-driven recording.

### 3.4 Remotion as the rendering primitive (and why RN is out)

- **Remotion:** "Make videos programmatically with React … Make videos agentically — Turn your idea into a video using your coding agent." Supports Player, batch rendering, etc. Source: [Remotion homepage](https://www.remotion.dev/)
- **AI codegen pattern:** Vercel AI SDK `generateText` with a Remotion system prompt → `MyComposition` using `useCurrentFrame`/`useVideoConfig`/`interpolate` → compile & render. Docs show `gpt-5.2` example and structured `Output.object({ code, title, durationInFrames, fps })`. Source: [Remotion docs — AI generate](https://www.remotion.dev/docs/ai/generate)
- **React Native caveat:** "Support for React Native is currently not planned due to performance issues … the model of re-rendering on every frame … would require significant architectural changes … integrate with Reanimated." Source: [Remotion — React Native docs](https://www.remotion.dev/docs/react-native) — i.e., Remotion renders *for* the app (App Store video about the app) but not *inside* the app.

**Implication:** Appshot works because it runs Remotion on the web (React DOM) to *illustrate* the RN app, not inside RN. Don't try to render Remotion inside Subby.

### 3.5 Replay (video → Expo app) — inverse direction

- **What it does:** "Replay analyzes video recordings of user interactions and leverages Gemini to reconstruct not just the UI, but the underlying logic and behavior … Generate a React Native application with Expo" from a demo video. Source: [Replay — Convert demo video to RN/Expo](https://www.replay.build/blog/how-to-convert-a-mobile-app-demo-video-to-a-react-native-app-with-expo-using-replay-ai) — the reverse of our task (demo→code, not code→demo), useful only if you have a reference video to clone.

---

## 4. Recommended Pipeline for Subby (Expo 57, dark `#0B0F14` / cyan `#22D3EE`)

### Option A — Reproducible & Beautiful (recommended, least new deps)

```
Maestro flows (scripts/maestro/ + testID)
  → maestro test with startRecording (MP4) + takeScreenshot (PNG)
  → Screen Studio (or Screenify) — auto-zoom, iPhone 15 Pro frame, Subby gradient bg, 4K 60fps
  → docs/demo/web/*.mp4 + .webm + -poster.jpg  (current hosting)
  → optional: fastlane frameit for store screenshots from same captures
```

- **Why:** Reuses Subby's existing Maestro setup; recordings are deterministic and CI-runnable (EAS Workflows `type: maestro`). Screen Studio adds the "beautiful" without a second toolchain. No new npm deps, no store-spec rendering work.
- **AI assist:** Add Maestro MCP (`claude mcp add maestro`) so an agent authors/maintains the flows: *"add a flow that covers yearly total → upcoming renewals → add-subscription with validation errors → search → detail → archive."*
- **Cost:** Maestro OSS + Screen Studio $89 one-time; EAS Workflows metered (or local `maestro test` free).

### Option B — Store-Preview Quality (App Store / Play 15–30 s)

```
Appshot skill  →  scans Subby → custom Remotion scenes → npm run build → 886×1920 H.264
  (or) expo-appstore-shots → headless RN-web render of real screens → ffmpeg → framed PNG/MP4
```

- **Pick Appshot** if you want a narrative marketing video (problem → feature → proof) with motion graphics. Source: [Appshot README](https://github.com/trunghaiy/appshot)
- **Pick expo-appstore-shots** if you want screenshots that are provably the app (drift-proof, `AGENTS.md` workflow for AI agents). Source: [expo-appstore-shots README](https://github.com/tranmani/expo-appstore-shots)
- Both can coexist: Appshot for the *preview video*, expo-appstore-shots for the *screenshots*.

### Option C — Marketing Site Hero (web, not native)

```
aidemo storyboard.json → deterministic Chrome replay → voice/captions/auto-zoom → final-demo.mp4
  → GitHub Action re-renders on every landing-page change (~$0 with local voice)
```

Source: [aidemo README](https://github.com/tandryukha/aidemo) — ideal for Subby's `site/` / `prototype-landing.html`; not for iOS demo.

---

## 5. What to Do Next (Concrete Steps)

1. **Instrument for AI:** Add `testID` to Subby's dashboard hero, sort/filter bar, add-form fields, and detail actions (already linted per `AGENTS.md`'s `use*` patterns — extend similarly). This is what Maestro and Expo MCP target.
2. **Extend flows:** Add `startRecording`/`stopRecording` + `takeScreenshot` checkpoints to `scripts/maestro/*.yaml`; verify with `maestro test .maestro/` locally, then promote to `.eas/workflows/e2e-tests.yml` (`type: maestro`) per [Expo E2E docs](https://docs.expo.dev/tutorial/cicd/e2e-tests/).
3. **One beautiful pass:** Open the simulator build via `npm run ios`, run the flow, capture the simulator window in Screen Studio (auto-zoom on taps, iPhone frame, Subby gradient), export 4K 60fps → replace `docs/demo/web/*.mp4`.
4. **Store assets when ready:** Run either `npx create-appshot` + Appshot skill *or* `npx expo-appstore-shots` init and seed `expo-sqlite` fixtures (per that tool's `setup` + `api.fixtures`). Validate output with `ffprobe` (both tools do internally) and `fastlane frameit` if framing separately.
5. **CI hardening (optional):** Add `tandryukha/aidemo@stable` action for `site/` demos; keep native demos deterministic via Maestro+EAS Workflows rather than fragile manual re-records.

---

## 6. Sources — Primary Only

- Maestro — React Native support: https://docs.maestro.dev/get-started/supported-platform/react-native
- Maestro — MCP: https://docs.maestro.dev/get-started/maestro-mcp
- Maestro — Pokedex E2E Part 2 (startRecording/takeScreenshot/subflows): https://maestro.dev/blog/pokedex-ui-testing-series-a-guide-to-end-to-end-react-native-testing-with-maestro-part-2
- mobile-dev-inc/counter-app-demo (agentic Maestro demo): https://github.com/mobile-dev-inc/counter-app-demo
- Expo — Run E2E tests with Maestro on EAS Workflows: https://docs.expo.dev/tutorial/cicd/e2e-tests/
- Expo — E2E examples: https://docs.expo.dev/eas/workflows/examples/e2e-tests/
- expo/skills — eas-simulator SKILL.md: https://github.com/expo/skills/blob/main/plugins/expo/skills/eas-simulator/SKILL.md
- expo/skills — eas-simulator run-your-app reference: https://github.com/expo/skills/blob/HEAD/plugins/expo/skills/eas-simulator/references/run-your-app.md
- Expo MCP docs: https://docs.expo.dev/mcp/
- DaveDev42/expo-mcp: https://github.com/DaveDev42/expo-mcp
- vasiliydumanov/rn-mcp: https://github.com/vasiliydumanov/rn-mcp
- slapglif/maestro-mcp: https://github.com/slapglif/maestro-mcp
- Screen Studio: https://screen.studio/ — Product demos: https://screen.studio/create/product-demo-videos
- Screenify Studio: https://www.screenify.studio/
- Screenfully: https://screenfully.app/
- Screenhance — App Demo Video Maker: https://screenhance.com/app-demo-video-maker
- Presenta: https://presenta-studio.vercel.app/
- Screen Charm: https://aitoolly.com/product/screen-charm
- fastlane — Screenshots: https://docs.fastlane.tools/getting-started/ios/screenshots/
- fastlane — frameit: https://fastlane-fastlane.mintlify.app/tools/frameit
- ntgussoni/app-store-play-store-screenshots-skill: https://github.com/ntgussoni/app-store-play-store-screenshots-skill
- trunghaiy/appshot: https://github.com/trunghaiy/appshot
- tranmani/expo-appstore-shots: https://github.com/tranmani/expo-appstore-shots
- tandryukha/aidemo: https://www.npmjs.com/package/@tandryukha/aidemo (+ https://github.com/tandryukha/aidemo)
- Remotion homepage: https://www.remotion.dev/ — AI generate: https://www.remotion.dev/docs/ai/generate — React Native (not planned): https://www.remotion.dev/docs/react-native
- Replay — video→RN/Expo: https://www.replay.build/blog/how-to-convert-a-mobile-app-demo-video-to-a-react-native-app-with-expo-using-replay-ai

---

*Saved per research skill at `docs/ai-demo-recording-research.md` — existing convention is `docs/*.md` (architecture, monetization, release). No `research/` folder existed; this file follows that pattern.*
