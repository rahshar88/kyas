import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Push notification registration — the §21.5 "push-token foundation".
 *
 * Registration only. Milestone 3 sends nothing, and that is deliberate: a token that exists
 * before there is anything to send is a token we can test, and a send path built before anyone
 * has agreed what is worth interrupting someone for is a send path that will interrupt them.
 *
 * §S13's permission pattern applies here too — ask only when the user chooses to, and return
 * to a usable screen when they decline. This service therefore never throws: every failure is
 * a described outcome, because "not now", "no thanks" and "this build has no push key" are all
 * ordinary states that the screen has to render calmly.
 *
 * `unavailable` is not a hypothetical branch. `getExpoPushTokenAsync` needs the
 * `aps-environment` entitlement on iOS, which EAS adds only once an Apple push key exists —
 * that key was generated on 14 August, so a real device now registers normally. The branch
 * remains correct for a simulator, for a fork with no EAS project id, and for any future build
 * whose credentials have lapsed. What changed is that it stopped being the expected outcome.
 */
export type PushRegistration =
  | { status: 'registered'; token: string; platform: 'ios' | 'android' }
  | { status: 'denied' }
  /** Simulators have no push service, and neither does a build without a push key. */
  | { status: 'unavailable'; detail?: string | undefined };

export interface PushService {
  currentPermission(): Promise<'granted' | 'denied' | 'undetermined'>;
  register(): Promise<PushRegistration>;
}

export const pushService: PushService = {
  async currentPermission() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') return 'granted';
      return status === 'denied' ? 'denied' : 'undetermined';
    } catch {
      return 'undetermined';
    }
  },

  async register(): Promise<PushRegistration> {
    try {
      const existing = await Notifications.getPermissionsAsync();
      let granted = existing.status === 'granted';

      // §13.1 and §S13: ask at the moment of choosing, never on launch.
      if (!granted) {
        const requested = await Notifications.requestPermissionsAsync();
        granted = requested.status === 'granted';
      }

      if (!granted) return { status: 'denied' };

      /**
       * The EAS project id, which the push service uses to route a token to this project.
       * It is committed in `app.config.ts`, so it is present in every build — but read
       * defensively, because a fork that cleared it should get `unavailable` rather than an
       * unhandled rejection on a screen someone opened out of curiosity.
       */
      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      if (projectId === undefined || projectId === '') {
        return { status: 'unavailable', detail: 'No EAS project id in this build.' };
      }

      const token = await Notifications.getExpoPushTokenAsync({ projectId });

      return {
        status: 'registered',
        token: token.data,
        platform: Platform.OS === 'android' ? 'android' : 'ios',
      };
    } catch (error) {
      /**
       * Everything lands here rather than propagating: a simulator, a missing push key, a
       * network failure during token exchange. The screen treats them the same way because the
       * user can do the same thing about all of them, which is nothing.
       */
      return {
        status: 'unavailable',
        detail: error instanceof Error ? error.message : undefined,
      };
    }
  },
};
