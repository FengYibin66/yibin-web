/** Shared typography bounds for publication card faces (card plane is 1.5 wide). */
export const PUBLICATION_TITLE_MAX_WIDTH = 1.22
export const PUBLICATION_BODY_MAX_WIDTH = 1.22

/** troika wraps CJK only when break-word is set — Chinese has no spaces. */
export const PUBLICATION_TEXT_OVERFLOW_WRAP = 'break-word' as const
