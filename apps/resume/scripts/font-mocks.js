/**
 * Mock responses for Google Fonts API, used during offline / CI builds.
 * Set NEXT_FONT_GOOGLE_MOCKED_RESPONSES=./scripts/font-mocks.js before `next build`.
 *
 * Each key is the exact URL that next/font/google fetches.
 * Values are minimal but valid @font-face CSS so the build succeeds.
 */
'use strict'

const interCss = `
/* latin */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
`

const spaceGroteskCss = `
/* latin */
@font-face {
  font-family: 'Space Grotesk';
  font-style: normal;
  font-weight: 300 700;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/spacegrotesk/v15/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gozwUi9bA.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
`

const jetbrainsCss = `
/* latin */
@font-face {
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 100 800;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjOdmtFD8.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
`

module.exports = {
  'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap': interCss,
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap': spaceGroteskCss,
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@100..800&display=swap': jetbrainsCss,
}
