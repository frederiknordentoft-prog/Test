/** One mock minute lasts this many real milliseconds while Live is on. */
export const MOCK_MINUTE_MS = 1000;
/** Prices move in steps of this many mock minutes. */
export const PRICE_STEP_MIN = 10;
/** Real time between price steps. Odds must never refresh faster than this. */
export const STEP_MS = MOCK_MINUTE_MS * PRICE_STEP_MIN;
