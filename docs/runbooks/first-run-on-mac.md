# Runbook — first run on a Mac

Getting KyaScene onto an iPhone simulator, and then a real phone. This closes the half of
Milestone 0's exit criterion that a Linux CI machine cannot: _"the signed development app
opens on iOS and Android."_

**You do not need an Apple Developer account, a Google Play account or a Supabase project to
do Stages 1–4.** The simulator needs none of them, and Milestone 0 has no backend code yet.

---

## Stage 1 — Install the tools (about 45 minutes, mostly Xcode downloading)

> **Run each block on its own.** Every code block in this runbook is safe to paste as a
> whole, and none of them contain `#` comments — macOS zsh does not treat `#` as a comment
> unless `setopt interactive_comments` has been set, so a pasted comment line becomes
> `zsh: command not found: #`.

**1. Xcode.** Install Xcode 16 or newer from the Mac App Store and open it once to accept the
licence. Then install the command line tools — no `sudo`, it opens a GUI installer:

```bash
xcode-select --install
```

Point the toolchain at the full Xcode rather than the standalone tools:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

**2. A simulator runtime.** Xcode → Settings → Components → download an iOS 18 runtime.

**3. Node, Watchman and CocoaPods.** Install [Homebrew](https://brew.sh) first if you do not
have it, then:

```bash
brew install node@22 watchman cocoapods
```

**4. Put Node 22 on your PATH.** Homebrew keeps `node@22` keg-only, so this step is required
or `node` will not be found at all. On an Intel Mac replace `/opt/homebrew` with
`/usr/local`:

```bash
echo 'export PATH="/opt/homebrew/opt/node@22/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
corepack enable
```

**5. Check the versions:**

```bash
node --version
pnpm --version
pod --version
xcodebuild -version
```

Expect Node v22.13 or newer, pnpm 10.x, CocoaPods 1.15 or newer, and Xcode 16 or newer.

If you use `nvm` instead of Homebrew for Node, `nvm use` in the repo root picks up the pinned
version from `.nvmrc` and you can skip step 4.

## Stage 2 — Get the code

```bash
git clone https://github.com/rahshar88/kyas.git
cd kyas
git checkout claude/new-session-944p35
pnpm install
```

## Stage 3 — Environment file

```bash
cp apps/mobile/.env.example apps/mobile/.env
open -e apps/mobile/.env
```

**You can leave every value as-is for now**, except the Supabase publishable key. Change:

```
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=replace-with-publishable-anon-key
```

to any text of 20 characters or more, for example
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=placeholder-key-until-milestone-1`. Save and close.

Nothing connects to Supabase in Milestone 0 — the Supabase client is not even installed yet.
The variables exist so Milestone 1 has somewhere to put real credentials.

The Sentry and analytics lines can stay blank. They are only required for beta and production
builds (§20).

`.env` is gitignored and never leaves your machine.

## Stage 4 — Run it on the iOS simulator

```bash
pnpm run mobile:ios
```

This generates the native iOS project, runs `pod install`, builds with Xcode and launches the
simulator. **The first run takes 10–20 minutes** — CocoaPods downloading and Xcode compiling
React Native from source. Subsequent runs take under a minute.

If it fails, see Troubleshooting below.

### What to check once it opens

|                 | Expected                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Launch          | KyaScene wordmark on dark green, brief spinner, then Welcome                                                                          |
| Welcome         | "Connect / Discover / Belong", "The beta is free and invite-only", Privacy and Terms links, "Powered by 1818"                         |
| "Join the beta" | Does nothing. Correct — registration is Milestone 1                                                                                   |
| Privacy / Terms | Open `kyascene.app/privacy` and `/terms` in Safari. Those pages do not exist yet, so expect a 404 — the wiring is what's being tested |
| Dark / light    | Simulator → Settings → Developer → Dark Appearance. The whole screen should re-colour                                                 |
| Large text      | Settings → Accessibility → Display & Text Size → Larger Text. Nothing should clip or overlap                                          |
| VoiceOver       | Settings → Accessibility → VoiceOver. Every button should announce a sensible name                                                    |

The launch screen's "couldn't start" state is hard to trigger by hand — it needs the session
check to hang for four seconds, which cannot happen yet because the check is a stub. It is
covered by the screenshots in the Milestone 0 review instead.

## Stage 5 — Run the same checks CI runs

```bash
pnpm run typecheck
pnpm run lint
pnpm run test          # expect 100+ passing
pnpm run mobile:doctor # expect 20/20
```

These all passed on Linux. Running them on your machine confirms there is nothing
environment-specific hiding.

## Stage 6 — A real iPhone (optional, still no paid account needed)

1. Plug the phone in, unlock it, tap **Trust**.
2. `open apps/mobile/ios/KyaSceneBeta.xcworkspace`
   — always the `.xcworkspace`, never the `.xcodeproj`, or CocoaPods dependencies are missing.
   The name comes from the app name, so in a development or beta build it is `KyaSceneBeta`;
   a production build produces `KyaScene`. The workspace only exists after `pod install` has
   run, which Stage 4 does for you.
3. In Xcode: select the **KyaSceneBeta** target → **Signing & Capabilities** → tick
   _Automatically manage signing_ → under Team choose **Add an Account** and sign in with your
   ordinary Apple ID. A free "Personal Team" appears.
4. Change the Bundle Identifier to something unique to you, e.g. `app.kyascene.beta.yourname`
   — free accounts cannot claim an identifier someone else may register.
5. Pick your phone from the device list and press ▶.
6. On the phone: Settings → General → VPN & Device Management → trust your developer
   certificate.

A free account's build stops working after 7 days. That is expected; the paid account at
Milestone 4 removes the limit.

**Do not commit the bundle identifier change.** `ios/` is gitignored, so as long as you edit
it in Xcode rather than in `app.config.ts`, nothing will be.

## Stage 7 — Android (optional, and can wait)

Android is Milestone 5. If you want to see it now:

```bash
brew install --cask android-studio
```

Then in Android Studio: **More Actions → SDK Manager** → install SDK 35 and the build tools;
**More Actions → Device Manager** → create a Pixel emulator and start it. Then:

```bash
pnpm run mobile:android
```

Add to `~/.zshrc`:

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
```

---

## Troubleshooting

**`KyaScene environment configuration is invalid`**
Working as designed. The message lists exactly which variables are missing. You skipped
Stage 3, or the Supabase key placeholder is shorter than 20 characters.

**`pod install` fails, or CocoaPods complains about the platform**

```bash
cd apps/mobile/ios && pod install --repo-update
```

On an Apple Silicon Mac with a Homebrew Ruby conflict, `sudo gem install cocoapods` and retry.

**Xcode build fails after a dependency change**
Regenerate the native project from scratch — it is disposable:

```bash
rm -rf apps/mobile/ios apps/mobile/android
pnpm run mobile:ios
```

Never edit anything inside `ios/` or `android/` expecting it to persist. Those folders are
generated from `app.config.ts` and are gitignored; the next regeneration discards your change.
Native settings belong in `app.config.ts`.

**Metro says it cannot resolve a module**

```bash
pnpm install
pnpm --filter @kyascene/mobile exec expo start --clear
```

**Simulator opens to a white screen**
Shake gesture (`Cmd+Ctrl+Z`) → Reload. If it persists, check the terminal running Metro for
the actual error.

---

## What to do about accounts

Nothing in Stages 1–7 needs a paid account. But two things are worth doing early because they
have lead time and can block Milestone 4:

1. **Check the app names are free.** §4.5 requires confirming `app.kyascene` and
   `app.kyascene.beta` are available in Apple Developer and Google Play Console _before_ the
   first signed build. If someone else holds one, every identifier in the project changes, and
   it is much cheaper to find out now.
2. **Start the Apple Developer Program enrolment** (AUD ~150/year). Organisation enrolment
   needs a D-U-N-S number and can take **one to four weeks**. Milestone 4 cannot ship without
   it.

Everything else — Supabase, Sentry, analytics, Play Console — is listed with its milestone in
the README's _Required external accounts_ table.
