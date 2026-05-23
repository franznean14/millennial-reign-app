export const studyBibleLightPalette = {
  page: "#f5f4f7",
  surface: "#ffffff",
  surfaceElevated: "#ece8f2",
  surfaceMuted: "#ede9f3",
  surfaceDeep: "#e4deea",
  surfaceActive: "#6b5196",
  border: "#e2dde8",
  purple: "#6b5196",
  foreground: "#1a1820",
  mutedForeground: "#6d6880",
  subtleForeground: "#8e89a3",
  inactive: "#8e8e93",
} as const;

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

/** Semantic Tailwind bundles — include light + dark so both modes stay in sync. */
export const studyBibleDarkClasses = {
  page: "bg-[#f5f4f7] text-[#1a1820] dark:bg-[#24231f] dark:text-[#fffaff]",
  card: "border-[#e2dde8] bg-[#ffffff] text-[#1a1820] dark:border-[#1c1921] dark:bg-[#30283c] dark:text-[#fffaff]",
  summaryCard:
    "border-[#e2dde8] bg-[#ffffff] text-[#1a1820] dark:border-[#1c1921] dark:bg-[#342a43] dark:text-[#fffaff]",
  bwiCard:
    "border-[#e2dde8] bg-[#ffffff] text-[#1a1820] dark:border-[#1c1921] dark:bg-[#30283c] dark:text-[#fffaff]",
  todoCard:
    "border-[#e2dde8] bg-[#faf8fc] text-[#1a1820] dark:border-[#1c1921] dark:bg-[#2a2534] dark:text-[#fffaff]",
  callsCard:
    "border-[#e2dde8] bg-[#f3eff8] text-[#1a1820] dark:border-[#1c1921] dark:bg-[#3b3348] dark:text-[#fffaff]",
  cardHover: "hover:bg-[#ece8f2] dark:hover:bg-[#3b3348]",
  header:
    "border-[#e2dde8] bg-[#ece8f2] text-[#1a1820] hover:bg-[#e4deea] dark:border-[#1c1921] dark:bg-[#3b3348] dark:text-[#fffaff] dark:hover:bg-[#4b405c]",
  callsHeader:
    "border-[#e2dde8] bg-[#e8e2ef] text-[#1a1820] hover:bg-[#e0d8e8] dark:border-[#1c1921] dark:bg-[#463b55] dark:text-[#fffaff] dark:hover:bg-[#514562]",
  activeHeader: "bg-[#6b5196] text-white dark:bg-[#80778e] dark:text-white",
  muted: "text-[#6d6880] dark:text-[#ded6e7]",
  subtle: "text-[#8e89a3] dark:text-[#cfc5db]",
  callsText: "text-[#1a1820] dark:text-[#fff7ff]",
  callsMuted: "text-[#6d6880] dark:text-[#e8e0ef]",
  divider: "border-[#e2dde8] dark:border-[#1c1921]",
  popoverPanel:
    "border-[#e2dde8] bg-[#ffffff] text-[#1a1820] dark:border-[#1c1921] dark:bg-[#342a43] dark:text-[#fffaff]",
  laneTitleBar: "bg-[#ede9f3] dark:bg-[#272133]",
  sheetEmptyWell: "border-[#e2dde8] bg-[#faf8fc]/80 dark:border-[#1c1921] dark:bg-[#30283c]/40",
  /** Bottom sheets and wide drawers */
  drawerPanel:
    "border-[#e2dde8] bg-[#ffffff] text-[#1a1820] dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff]",
  drawerHeader: "bg-[#ffffff] dark:bg-[#181714]",
  tableHeader: "border-[#e2dde8] bg-[#ffffff] dark:border-[#1c1921] dark:bg-[#30283c]",
  tableBody: "bg-[#f5f4f7] dark:bg-[#24231f]",
  navBar: "border-[#e2dde8] bg-[#ffffff] dark:border-[#1c1921] dark:bg-[#2a2534]",
  toggleShell: "border-[#e2dde8] bg-[#ede9f3] dark:border-[#1c1921] dark:bg-[#2a2534]",
  toggleItem:
    "border border-transparent ring-0 data-[state=on]:ring-0 focus-visible:ring-0 text-[#6d6880] hover:bg-[#ece8f2] hover:border-transparent data-[state=on]:!border-[#6b5196] data-[state=on]:!bg-[#6b5196] data-[state=on]:!text-white dark:text-[#ded6e7] dark:hover:bg-[#3b3348] dark:hover:border-transparent dark:data-[state=on]:!border-[#80778e] dark:data-[state=on]:!bg-[#80778e] dark:data-[state=on]:!text-white",
  rowActionButton:
    "border-[#e2dde8] bg-[#ffffff] text-[#1a1820] hover:bg-[#ece8f2] active:bg-[#e4deea] dark:border-[#1c1921] dark:bg-[#272133] dark:text-[#fffaff] dark:hover:bg-[#3b3348] dark:active:bg-[#463b55]",
  /** Unchecked/checked boxes on tinted todo and form rows */
  checkbox:
    "border-[#8e89a3] bg-[#ffffff] shadow-none data-[state=checked]:border-[#6b5196] data-[state=checked]:bg-[#6b5196] data-[state=checked]:text-white dark:border-[#80778e] dark:bg-[#3b3348] dark:data-[state=checked]:border-[#80778e] dark:data-[state=checked]:bg-[#80778e] dark:data-[state=checked]:text-white",
  checkboxPlaceholder:
    "border-[#8e89a3] bg-[#ffffff] dark:border-[#80778e] dark:bg-[#3b3348]",
  /** Solid circular/pill controls in drawer filter toolbars (Calls, To-Do, BWI). */
  filterToolbarButton:
    "border-[#e2dde8] !bg-[#ece8f2] text-[#1a1820] hover:!bg-[#e4deea] active:!bg-[#ded6e7] [&>svg]:text-[#1a1820] dark:border-[#1c1921] dark:!bg-[#3b3348] dark:text-[#fffaff] dark:hover:!bg-[#463b55] dark:active:!bg-[#514562] dark:[&>svg]:text-[#fffaff]",
  filterToolbarButtonActive:
    "border-[#6b5196] !bg-[#6b5196] !text-white hover:!bg-[#5d4788] [&>svg]:!text-white dark:border-[#80778e] dark:!bg-[#80778e] dark:!text-white dark:hover:!bg-[#8c839a] dark:[&>svg]:!text-white",
  drawerHandle:
    "bg-[#6b5196] shadow-[0_0_18px_rgba(107,81,150,0.35)] dark:bg-[#80778e] dark:shadow-[0_0_18px_rgba(128,119,142,0.45)]",
  /** Tappable card title bar — same surface as card body (not a contrasting header strip). */
  cardBarHeader:
    "border-[#e2dde8] bg-[#ffffff] text-[#1a1820] dark:border-[#1c1921] dark:bg-[#30283c] dark:text-[#fffaff]",
} as const;

/** Flush segmented toggles — no inner padding; shell overflow clips square items for smooth corners. */
const sectionToggleItemRadius =
  "shadow-none ring-0 outline-none !rounded-none first:!rounded-none last:!rounded-none focus-visible:ring-0 data-[state=on]:ring-0";

function joinStudyBibleClasses(...parts: string[]) {
  return parts.filter(Boolean).join(" ");
}

export const studyBibleSectionToggle = {
  shell:
    "relative w-full min-w-0 overflow-hidden rounded-xl border shadow-lg border-[#e2dde8] bg-[#ffffff] dark:border-[#1c1921] dark:bg-[#30283c]",
  shellRow:
    "relative flex w-full min-w-0 items-center overflow-hidden rounded-xl border shadow-lg border-[#e2dde8] bg-[#ffffff] dark:border-[#1c1921] dark:bg-[#30283c]",
  /** Muted track for year/day pickers (single row, scrollable) */
  trackShell:
    "relative w-full overflow-hidden rounded-xl border shadow-lg border-[#e2dde8] bg-[#ede9f3] dark:border-[#1c1921] dark:bg-[#2a2534]",
  group: "flex h-full min-h-0 w-full min-w-full gap-0 rounded-none",
  item: joinStudyBibleClasses(
    sectionToggleItemRadius,
    "min-w-0 bg-transparent",
    studyBibleDarkClasses.toggleItem
  ),
  itemIcon:
    "flex h-full min-h-0 flex-1 min-w-0 w-full flex-col items-center justify-center gap-0.5 px-2 py-0 transition-colors",
  itemCompact:
    "flex h-11 min-w-0 items-center justify-center px-3 text-[11px] font-medium transition-colors md:h-12",
  ghostSideButton:
    "flex h-full min-h-0 shrink-0 items-center justify-center self-stretch rounded-none px-3 py-0 transition-colors hover:bg-[#ece8f2] dark:hover:bg-[#3b3348]",
  /** Embedded card tabs (All / Calls, Upcoming / All) — active tab matches card body surface. */
  cardTabList:
    "relative z-10 mb-0 -mb-px grid h-auto w-full gap-0 border-0 bg-[#ede9f3] p-0 dark:bg-[#2a2534] [&>*]:border-0",
  cardTabTrigger:
    "relative h-10 rounded-none rounded-bl-none rounded-br-none border border-transparent px-4 font-medium shadow-none ring-0 outline-none transition-all duration-200 after:hidden focus-visible:outline-none focus-visible:ring-0 bg-[#ede9f3] text-[#6d6880] hover:bg-[#ece8f2] hover:text-[#1a1820] hover:border-transparent dark:bg-[#2a2534] dark:text-[#ded6e7] dark:hover:bg-[#342a43] dark:hover:text-[#fffaff] dark:hover:border-transparent data-[state=active]:!border-[#ffffff] data-[state=active]:!bg-[#ffffff] data-[state=active]:!text-[#1a1820] data-[state=active]:hover:!border-[#ffffff] data-[state=active]:hover:!bg-[#ffffff] dark:data-[state=active]:!border-[#30283c] dark:data-[state=active]:!bg-[#30283c] dark:data-[state=active]:!text-[#fffaff] dark:data-[state=active]:hover:!border-[#30283c] dark:data-[state=active]:hover:!bg-[#30283c] [&>svg]:text-[#6d6880] hover:[&>svg]:text-[#1a1820] data-[state=active]:[&>svg]:!text-[#1a1820] dark:[&>svg]:text-[#ded6e7] dark:hover:[&>svg]:text-[#fffaff] dark:data-[state=active]:[&>svg]:!text-[#fffaff]",
  cardTabTriggerLeft: "rounded-tl-lg rounded-tr-none",
  cardTabTriggerRight: "rounded-tr-lg rounded-tl-none",
  cardTabContent: "mt-0 rounded-b-lg bg-[#ffffff] p-4 dark:bg-[#30283c]",
} as const;

const studyBibleLightCardShadeClasses = [
  "bg-[#ffffff]",
  "bg-[#faf8fc]",
  "bg-[#f3eff8]",
  "bg-[#ece7f3]",
  "bg-[#f5f2f8]",
  "bg-[#e8e2ef]",
] as const;

const studyBibleDarkCardShadeClasses = [
  "dark:bg-[#30283c]",
  "dark:bg-[#342a43]",
  "dark:bg-[#3b3348]",
  "dark:bg-[#2a2534]",
  "dark:bg-[#272133]",
  "dark:bg-[#463b55]",
] as const;

const studyBibleLightCardFadeClasses = [
  "from-[#ffffff] via-[#ffffff]/50",
  "from-[#faf8fc] via-[#faf8fc]/50",
  "from-[#f3eff8] via-[#f3eff8]/50",
  "from-[#ece7f3] via-[#ece7f3]/50",
  "from-[#f5f2f8] via-[#f5f2f8]/50",
  "from-[#e8e2ef] via-[#e8e2ef]/50",
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
  const index = getStablePaletteIndex(key, studyBibleLightCardShadeClasses.length);
  return `${studyBibleLightCardShadeClasses[index]} ${studyBibleDarkCardShadeClasses[index]}`;
}

export function getStudyBibleDarkCardFade(key: string) {
  const index = getStablePaletteIndex(key, studyBibleLightCardFadeClasses.length);
  return `${studyBibleLightCardFadeClasses[index]} ${studyBibleDarkCardFadeClasses[index]}`;
}
