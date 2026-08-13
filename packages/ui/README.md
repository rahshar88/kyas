# @kyascene/ui

Design tokens and the shared mobile component library, built from spec §7.

**No third-party UI kit.** §4.4: _"Do not install a large UI kit. Build KyaScene's small
component library from design tokens."_ Everything here is React Native primitives plus
`react-native-safe-area-context`.

## Tokens

| Group                          | Source | File                       |
| ------------------------------ | ------ | -------------------------- |
| Brand colours + semantic roles | §7.1   | `src/tokens/colors.ts`     |
| Spacing, radius, touch targets | §7.3   | `src/tokens/layout.ts`     |
| Type scale, system fonts       | §7.2   | `src/tokens/typography.ts` |

### Why status colours have separate text and fill roles

The measured contrast of the raw §7.1 tokens on Scene Emerald:

| Pair                         | Ratio      | Verdict          |
| ---------------------------- | ---------- | ---------------- |
| Warm Cream on Scene Emerald  | 13.41:1    | AA text ✅       |
| Night on Scene Saffron       | 7.35:1     | AA text ✅       |
| Mint on Scene Emerald        | 8.49:1     | AA text ✅       |
| **Error on Scene Emerald**   | **2.96:1** | ❌ fails AA text |
| **Warning on Scene Emerald** | **3.56:1** | ❌ fails AA text |
| Warm Cream on Error          | 4.52:1     | AA text ✅       |
| Night on Warning             | 4.52:1     | AA text ✅       |

Error and Warning are **fill** colours — correct as a badge or button background with a
Night or Warm Cream label, unreadable as body text on a dark surface. So each status has a
`*Fill` role (the brand token) and a `*Text` role (an AA-clearing tint).
`src/tokens/__tests__/contrast.test.ts` enforces every pair, so a palette edit that breaks
§7.5 fails CI instead of shipping.

## Component inventory (§7.4)

§7.4 names 26 P0 components. Milestone 0 builds the six that S00 and S01 actually consume;
each of the rest arrives with the screen that first needs it, so it is designed against
real usage rather than guessed at.

| Component             | Status                                   | First needed by    |
| --------------------- | ---------------------------------------- | ------------------ |
| `AppScreen`           | ✅ built                                 | S00                |
| `KyaSceneWordmark`    | ✅ built (text stand-in; asset lands M4) | S00                |
| `PoweredBy1818`       | ✅ built                                 | S00                |
| `PrimaryButton`       | ✅ built                                 | S01                |
| `SecondaryButton`     | ✅ built                                 | S01                |
| `TextButton`          | ✅ built                                 | S01                |
| `AppHeader`           | ✅ built                                 | S05 (M1)           |
| `TextField`           | ✅ built                                 | S02 (M1)           |
| `EmailField`          | ✅ built                                 | S02 (M1)           |
| `StepProgress`        | ✅ built                                 | S05 (M1)           |
| `ChoiceCard`          | ✅ built                                 | S05 (M1)           |
| `InlineError`         | ✅ built                                 | S02 (M1)           |
| `OfflineBanner`       | ✅ built                                 | S06 (M1)           |
| `SelectField`         | ✅ built                                 | S06 (M1)           |
| `SearchField`         | pending                                  | S06 (M1)           |
| `LoadingSkeleton`     | pending                                  | S06 (M1)           |
| `FullScreenError`     | pending                                  | S00 hardening (M1) |
| `MultiSelectChips`    | ✅ built                                 | S09 (M2)           |
| `StudentAvatar`       | pending                                  | S13 (M2)           |
| `ProfileSummaryCard`  | ✅ built                                 | S16 (M2)           |
| `PermissionExplainer` | pending                                  | S13 (M2)           |
| `StatusBadge`         | ✅ built                                 | S17 (M2)           |
| `IconButton`          | pending                                  | S13 (M2)           |
| `Toast`               | pending                                  | S14 (M2)           |
| `EmptyState`          | pending                                  | S18 (M3)           |
| `ConfirmationSheet`   | pending                                  | S22 (M3)           |
| `DestructiveButton`   | pending                                  | S22 (M3)           |
| `ToggleRow`           | ✅ built (beyond §7.4)                   | S14 (M2)           |
| `ConsentCheckbox`     | ✅ built (beyond §7.4)                   | S15 (M2)           |

Two components are not in §7.4's list of 26. `ToggleRow` exists because S14 needs six labelled
switches on one screen and S08 had already written two inline — six hand-built rows is six
chances for the visible label and the accessibility label to drift apart. `ConsentCheckbox`
exists because §S15 forbids bundling required and optional consent, and a component that can
only ever represent **one** policy is what makes an "accept all" control impossible to add by
accident.

## Rules for every component

From §7.4 and §7.5, non-negotiable:

- loading, disabled, pressed and focus states where applicable
- `accessibilityRole` and a meaningful `accessibilityLabel`
- `accessibilityState` carrying `disabled` and `busy`
- minimum 48×48 interactive target (`layout.minTouchTarget`) — via `hitSlop` if the visible
  control is smaller
- no fixed heights that clip text under Dynamic Type; never `allowFontScaling={false}`
- never communicate status by colour alone — pair with text or an icon
