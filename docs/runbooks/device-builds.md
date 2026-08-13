# Runbook — installing on a phone, and updating it without a cable

The tethered `expo run:ios --device` build is a development build: its JavaScript is served
by Metro on your Mac, so the app stops working the moment you close the terminal or leave the
network. Useful while writing code, useless for carrying around.

This runbook sets up the other kind — a standalone build you install once, which then picks
up new code **over the air in seconds**, with no cable and no Mac running.

## How the two pieces fit

|                | What it does                                                             | When you run it                                               |
| -------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| **EAS Build**  | Produces a real signed `.ipa` in the cloud and gives you an install link | Once, then only when native code changes                      |
| **EAS Update** | Pushes new JavaScript to already-installed apps                          | Every time you want the phone to see a change — takes seconds |

The distinction is enforced automatically. `app.config.ts` sets a **fingerprint runtime
version**, which hashes the native project. Change a screen, some copy or a validation rule
and it ships over the air. Add a native module and the fingerprint changes, so EAS refuses to
send that update to an incompatible binary and tells you a new build is needed — rather than
shipping an update the installed app cannot run.

## One-time setup

You need an Expo account. The free plan is enough to start; iOS builds queue rather than
running immediately.

```bash
cd ~/kyas
```

Always after a pull. Dependencies change often, and `expo config` resolves native modules, so
a stale `node_modules` fails with an unhelpful "exited with non-zero code: 1":

```bash
pnpm install
```

```bash
npx eas-cli@latest login
```

```bash
cd apps/mobile && npx eas-cli@latest init
```

`init` prints a **project ID** (a UUID). Because this project uses a dynamic `app.config.ts`
rather than a static `app.json`, EAS cannot write it in for you. Open
`apps/mobile/app.config.ts`, find:

```ts
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? '';
```

and put the id in the fallback:

```ts
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? 'the-uuid-eas-printed';
```

Until that is filled in, over-the-air updates are simply not configured and everything else
works exactly as before — a fresh clone is never blocked on having an Expo account.

## Build it (about 15–25 minutes, mostly queueing)

```bash
cd ~/kyas
```

```bash
pnpm run eas:build:preview
```

EAS will ask to generate a **distribution certificate** and **provisioning profile** — say
yes, it manages them for you. It then asks to register your device: it shows a QR code, you
scan it with the iPhone, and iOS installs a registration profile.

When the build finishes you get a URL. Open it **on the phone**, tap Install, and KyaScene
appears on the home screen like any other app.

This uses the `preview` profile: internal distribution, real device, and the `development`
environment — so it needs no Sentry or analytics keys, which the `beta` profile does require
(§20).

## Update it (seconds)

After that, this is the whole loop:

```bash
cd ~/kyas
```

```bash
git pull
```

```bash
pnpm install
```

```bash
pnpm run eas:update
```

It bundles the JavaScript, uploads it, and every installed copy on the `preview` channel picks
it up. **Close the app fully and reopen it** — updates are fetched on launch, so a background
app will not see them.

## When you need a new build instead

Only when the native layer changes:

- a new package with native code (`expo install something-native`)
- a change to `app.config.ts` permissions, icons, splash or identifiers
- an Expo SDK upgrade

`pnpm run eas:update` will tell you if the fingerprint no longer matches. Re-run
`pnpm run eas:build:preview` and reinstall.

## Which build should I be running?

| Situation                           | Use                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------- |
| Writing code, want instant reload   | `pnpm run mobile:ios` — tethered, Metro on your Mac                       |
| Carrying it around, showing someone | `pnpm run eas:build:preview` once, then `pnpm run eas:update`             |
| Real external testers               | TestFlight, at Milestone 4 — needs the `beta` profile and live legal URLs |

## Troubleshooting

**"No devices registered."** Run `npx eas-cli@latest device:create` and scan the QR code on the
phone. Each physical device must be registered against your Apple account before an internal
build will install on it.

**The build fails on credentials.** `npx eas-cli@latest credentials` lets you inspect and
reset them. Letting EAS manage signing is almost always the right answer.

**`eas update` says the runtime version does not match.** That is the fingerprint check doing
its job — the native project changed. Build again.

**The phone does not pick up an update.** Force-close the app (swipe up from the app switcher)
and reopen. Updates apply on launch, not while running.

**"Project not configured for EAS Update."** `EAS_PROJECT_ID` is still empty in
`app.config.ts`. See the one-time setup above.

**`expo/bin/cli config --json exited with non-zero code: 1`.** Almost always a stale
`node_modules` after a pull that changed dependencies. Run `pnpm install` from the repository
root and retry. To see the real error rather than the exit code, run `npx expo config --json`
inside `apps/mobile` directly.

## Costs

The Expo free plan includes a limited number of cloud builds per month with a shared queue —
fine at this stage. EAS Update is free for the volumes a closed beta produces. If build queue
times become annoying, the paid plan removes them; that is a §22 founder decision, not one to
make by default.
