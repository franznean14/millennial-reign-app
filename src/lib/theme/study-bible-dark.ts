export const studyBibleDarkPalette = {
  page: "#24231f",
  surface: "#30283c",
  surfaceElevated: "#3b3348",
  surfaceMuted: "#2a2534",
  surfaceDeep: "#272133",
  surfaceActive: "#80778e",
  border: "#1c1921",
  purple: "#563985",
  foreground: "#fffaff",
  mutedForeground: "#ded6e7",
  subtleForeground: "#cfc5db",
} as const;

export const studyBibleDarkClasses = {
  page: "dark:bg-[#24231f] dark:text-[#fffaff]",
  card: "dark:border-[#1c1921] dark:bg-[#30283c] dark:text-[#fffaff]",
  summaryCard: "dark:border-[#1c1921] dark:bg-[#342a43] dark:text-[#fffaff]",
  bwiCard: "dark:border-[#1c1921] dark:bg-[#30283c] dark:text-[#fffaff]",
  todoCard: "dark:border-[#1c1921] dark:bg-[#2a2534] dark:text-[#fffaff]",
  callsCard: "dark:border-[#1c1921] dark:bg-[#3b3348] dark:text-[#fffaff]",
  cardHover: "dark:hover:bg-[#3b3348]",
  header: "dark:border-[#1c1921] dark:bg-[#3b3348] dark:text-[#fffaff] dark:hover:bg-[#4b405c]",
  callsHeader: "dark:border-[#1c1921] dark:bg-[#463b55] dark:text-[#fffaff] dark:hover:bg-[#514562]",
  activeHeader: "dark:bg-[#80778e] dark:text-white",
  muted: "dark:text-[#ded6e7]",
  subtle: "dark:text-[#cfc5db]",
  callsText: "dark:text-[#fff7ff]",
  callsMuted: "dark:text-[#e8e0ef]",
  divider: "dark:border-[#1c1921]",
  /** Popovers, auxiliary bottom drawers, confirm sheets from bulk BWI flows */
  popoverPanel: "dark:border-[#1c1921] dark:bg-[#342a43] dark:text-[#fffaff]",
  /** Lane / section title strip inside bulk sheets */
  laneTitleBar: "dark:bg-[#272133]",
  /** Dashed empty-state well before any rows exist */
  sheetEmptyWell: "dark:border-[#1c1921] dark:bg-[#30283c]/40",
} as const;

const studyBibleDarkCardShadeClasses = [
  "dark:bg-[#30283c]",
  "dark:bg-[#342a43]",
  "dark:bg-[#3b3348]",
  "dark:bg-[#2a2534]",
  "dark:bg-[#272133]",
  "dark:bg-[#463b55]",
] as const;

const studyBibleDarkCardFadeClasses = [
  "dark:from-[#30283c] dark:via-[#30283c]/50",
  "dark:from-[#342a43] dark:via-[#342a43]/50",
  "dark:from-[#3b3348] dark:via-[#3b3348]/50",
  "dark:from-[#2a2534] dark:via-[#2a2534]/50",
  "dark:from-[#272133] dark:via-[#272133]/50",
  "dark:from-[#463b55] dark:via-[#463b55]/50",
] as const;

function getStablePaletteIndex(key: string, length: number) {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return hash % length;
}

export function getStudyBibleDarkCardShade(key: string) {
  return studyBibleDarkCardShadeClasses[getStablePaletteIndex(key, studyBibleDarkCardShadeClasses.length)];
}

export function getStudyBibleDarkCardFade(key: string) {
  return studyBibleDarkCardFadeClasses[getStablePaletteIndex(key, studyBibleDarkCardFadeClasses.length)];
}
