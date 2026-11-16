import { type SessionState, isValidSession } from './storage';
import { parsePuzzleParams, samePuzzleDate } from './url';

export type GameStart = {
  previewYesterday?: boolean;
  month?: number;
  day?: number;
  weekday?: number;
  session?: SessionState;
};

/** Decide preview vs restored play vs a fresh date from the URL. */
export function resolveStart(options: {
  search?: string;
  session?: SessionState | null;
  previewYesterday?: boolean;
}): GameStart {
  const urlDate = options.search ? parsePuzzleParams(options.search) : null;
  const session = options.session && isValidSession(options.session) ? options.session : null;

  if (urlDate) {
    if (session && samePuzzleDate(session, urlDate)) {
      return {
        month: urlDate.month,
        day: urlDate.day,
        weekday: urlDate.weekday,
        session,
      };
    }
    return { month: urlDate.month, day: urlDate.day, weekday: urlDate.weekday };
  }

  if (session) {
    return {
      month: session.month,
      day: session.day,
      weekday: session.weekday,
      session,
    };
  }

  return { previewYesterday: options.previewYesterday === true };
}
