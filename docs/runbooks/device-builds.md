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

## One-time setup — already done

The EAS project exists and its id is committed, so **there is nothing to set up**. Skip to
"Build it" below.

For the record, and for anyone forking this repository:

- Project: [@nighthawk-productions-pty-ltd/kyascene](https://expo.dev/accounts/nighthawk-productions-pty-ltd/projects/kyascene)
- Id: `d1f7b10c-c114-4d66-8f34-fe0892d0bec9`, committed in `apps/mobile/app.config.ts`
- Why the organisation account and not a personal one: [ADR-0004](../decisions/0004-eas-project-ownership.md)

You do need to be logged in on the machine that runs builds:

```bash
npx eas-cli@latest login
```

The free plan is enough to start; iOS builds queue rather than running immediately.

### If you are pointing a fork at your own EAS project

```bash
cd ~/kyas/apps/mobile
```

```bash
npx eas-cli@latest init
```

It will create the project and then fail to write the id back with
`Cannot read properties of undefined (reading 'CommonJS')`. That is expected — see the
troubleshooting section. Take the id from the project dashboard and edit
`apps/mobile/app.config.ts`:

```ts
const EAS_OWNER = process.env.EAS_OWNER ?? 'your-account';
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? 'your-uuid';
```

Set both to `''` and over-the-air updates are simply not configured; everything else works
exactly as before, so a fresh clone is never blocked on having an Expo account.

## Build it (about 15–25 minutes, mostly queueing)

```bash
cd ~/kyas
```

```bash
git pull
```

Always after a pull. Dependencies change often, and `expo config` resolves native modules, so
a stale `node_modules` fails with an unhelpful "exited with non-zero code: 1":

```bash
pnpm install
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

### The trap this command exists to close

**`eas update` does not read build profiles.** `eas build --profile preview` takes its
environment from that profile's `env` block in `eas.json`; an update takes its environment from
whatever `process.env` and `.env` the machine running it happens to have. They are different
mechanisms that look like the same one.

So a correctly configured build can be silently downgraded by the next update — and `.env` is
gitignored, which is what makes it quiet: the file differs per machine by design and nobody
reviews it. A stale project URL in it fails at DNS lookup, which reaches the app as
`Network request failed`, is classified `NETWORK_UNAVAILABLE`, and is shown to a tester as
_"We couldn't reach KyaScene"_ — a configuration mistake wearing a connectivity error's
clothes, for a server that was answering fine throughout. It cost most of a day on 13 August.

`pnpm run eas:update` therefore goes through `scripts/eas-update.mjs`, which resolves the build
profile's `env` exactly as EAS merges it — `extends` chain included — and injects it into the
update. Expo's dotenv loader does not overwrite variables that are already set, so `eas.json`
wins over `.env` rather than fighting it. A disagreement is reported by name (never by value),
because a `.env` that contradicts `eas.json` means somebody's mental model is wrong even when
the outcome is now correct.

It also sets `--message` to the last commit subject, so the update list in the Expo dashboard
reads as a history. That used to be a string hard-coded in `package.json`, which meant every
update after the first was labelled with the name of an unrelated old fix.

### Did the phone actually take the update?

Updates apply on **launch**, so a backgrounded app keeps running the bundle it started with —
and an app that never fully closed can sit on a weeks-old bundle while you debug the symptoms
of code you have already fixed. Force-close it (swipe up in the app switcher) and reopen.

To confirm from the phone rather than assume: on an internal build, a failed sign-in shows a
grey technical line under the error and a **Check the connection** button. If you do not see
those, the phone is not running current code, and nothing you observe reflects the repository.

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

**The build fails at "Read app config".** A profile is missing an environment variable. The
build server has no `.env` — that file is gitignored, so it is not uploaded — which means the
profile's `env` block in `eas.json` is the entire environment. EAS reports this as
`Unknown error. See logs of the Read app config build phase`, which names neither the variable
nor the file; open that phase in the build logs and the real message is there, listing every
missing key.

You should not hit this: `pnpm run eas:build:preview` runs both verifiers first and refuses to
queue a build that cannot read its config. To check any profile by hand:

```bash
node scripts/verify-eas-config.mjs --profile preview
```

```bash
node scripts/verify-eas-build-env.mjs --profile preview
```

**"Project not configured for EAS Update."** `EAS_PROJECT_ID` is empty in `app.config.ts`. In
this repository it is committed, so this should not happen — check you have not set an empty
`EAS_PROJECT_ID` in your shell or in `apps/mobile/.env`, which overrides the committed value.

**`eas init` fails with `Cannot read properties of undefined (reading 'CommonJS')`.** The
project was almost certainly created anyway — check the dashboard before running it again.
What failed is the CLI writing the project id back into your config: `eas init` expects a
static `app.json`, and this repository uses a dynamic `app.config.ts` because the environment
must be validated at config time (ADR-0003). Code cannot be machine-edited, so paste the id in
by hand. It is not a sign that the config is broken — `npx expo config --json` inside
`apps/mobile` resolves the same file without complaint, and that is the command every other
EAS operation actually uses.

**"Must configure EAS project by running `eas init`"** after that failure. `eas project:info`
needs the id to already be configured, so it cannot help you recover it. Get it from the
dashboard instead: **Project settings → General**, or click the project name on the overview
page and read **ID** from the Project details panel.

**"Project not found" or a project belonging to the wrong account.** Your Expo login can reach
more than one account. `owner` in `app.config.ts` names the right one; if you have overridden
`EAS_OWNER`, that is why.

**`expo/bin/cli config --json exited with non-zero code: 1`.** Almost always a stale
`node_modules` after a pull that changed dependencies. Run `pnpm install` from the repository
root and retry. To see the real error rather than the exit code, run `npx expo config --json`
inside `apps/mobile` directly.

## Costs

The Expo free plan includes a limited number of cloud builds per month with a shared queue —
fine at this stage. EAS Update is free for the volumes a closed beta produces. If build queue
times become annoying, the paid plan removes them; that is a §22 founder decision, not one to
make by default.
