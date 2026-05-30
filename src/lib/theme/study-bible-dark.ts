export const studyBibleLightPalette = {
  page: "#f5f4f7",
  surface: "#e8e2ef",
  surfaceElevated: "#ece8f2",
  surfaceMuted: "#e4deea",
  surfaceDeep: "#ded6e7",
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
  card: "border-[#e2dde8] bg-[#e8e2ef] text-[#1a1820] dark:border-[#1c1921] dark:bg-[#30283c] dark:text-[#fffaff]",
  summaryCard:
    "border-[#e2dde8] bg-[#e4deea] text-[#1a1820] dark:border-[#1c1921] dark:bg-[#342a43] dark:text-[#fffaff]",
  bwiCard:
    "border-[#e2dde8] bg-[#e8e2ef] text-[#1a1820] dark:border-[#1c1921] dark:bg-[#30283c] dark:text-[#fffaff]",
  todoCard:
    "border-[#d4c8e4] bg-[#ded6e7] text-[#1a1820] dark:border-[#1c1921] dark:bg-[#2a2534] dark:text-[#fffaff]",
  /** Individual to-do rows (card preview + drawer lists). */
  todoRow:
    "border border-[#d4c8e4] bg-[#f5f2f8] shadow-[0_1px_2px_rgba(93,71,136,0.1)] dark:border-transparent dark:bg-transparent dark:shadow-none",
  todoRowStripe: "bg-[#ebe4f2] dark:bg-[#30283c]/40",
  /** In-card section labels (To-Do / Open / Done). */
  sectionLabel: "text-[#5d4788] dark:text-[#ded6e7]",
  /** Home To-Do — assigned / “To-Do” counts (header + section chips). */
  todoBadgeAssigned:
    "border-[#6b5196] bg-[#6b5196] font-semibold text-white shadow-none hover:bg-[#6b5196] dark:border-[#80778e] dark:bg-[#80778e] dark:text-white",
  /** Home To-Do — unassigned pool / “Open” counts. */
  todoBadgeOpen:
    "border-[#5d4788]/55 bg-[#d8c8f0] font-semibold text-[#4a3870] shadow-none hover:bg-[#d8c8f0] dark:border-[#80778e]/50 dark:bg-[#463b55] dark:text-[#fffaff]",
  /** Collapsible drawer section chrome (mobile stacked + tablet columns). */
  todoDrawerSectionShell:
    "border border-[#d4c8e4] bg-[#ded6e7] dark:border-[#1c1921] dark:bg-[#30283c]",
  todoDrawerSectionHeader:
    "text-sm font-bold text-[#5d4788] hover:text-[#1a1820] transition-colors dark:text-[#ded6e7] dark:hover:text-[#fffaff]",
  todoDrawerSectionBody:
    "border-x border-b border-[#d4c8e4] bg-[#f5f2f8] dark:border-[#1c1921] dark:bg-[#2a2534]",
  todoDrawerColumnShell:
    "overflow-hidden rounded-lg border border-[#d4c8e4] bg-[#f0ebf5] dark:border-[#1c1921] dark:bg-[#2a2534]",
  todoDrawerColumnHeader:
    "shrink-0 border-b border-[#d4c8e4] bg-[#ded6e7] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#5d4788] dark:border-[#1c1921] dark:bg-[#30283c] dark:text-[#ded6e7]",
  todoMeta: "text-[#6d6880] dark:text-[#ded6e7]",
  /** Field Service drawer form — light-mode lavender accents (no extra chrome). */
  fieldServiceSubtitle: "text-[#5d4788] dark:text-[#ded6e7]",
  /** Inherit drawer shell tint — no separate pane fill in light mode. */
  fieldServiceCalendarPane: "bg-transparent",
  fieldServiceFormPane: "bg-transparent",
  fieldServiceDivider: "border-[#d4c8e4] dark:border-[#1c1921]",
  fieldServiceLabel: "font-medium text-[#5d4788] dark:text-[#ded6e7]",
  fieldServiceWeekday: "text-[#6d6880] dark:text-[#ded6e7]",
  fieldServiceNavControl:
    "text-[#5d4788] hover:bg-[#ded6e7] hover:text-[#1a1820] dark:text-[#ded6e7] dark:hover:bg-[#3b3348] dark:hover:text-[#fffaff]",
  fieldServiceInput:
    "border-[#c8bdd6] bg-[#f5f2f8] text-[#1a1820] placeholder:text-[#8e89a3] focus-visible:border-[#6b5196] focus-visible:ring-[#6b5196]/20 dark:border-[#5a5068] dark:bg-[#2a2534] dark:text-[#fffaff] dark:placeholder:text-[#ded6e7]/70",
  fieldServiceChip:
    "border-[#c8bdd6] bg-[#e8e0f2] text-[#5d4788] dark:border-[#5a5068] dark:bg-[#3b3348] dark:text-[#ded6e7]",
  fieldServiceHoursControl:
    "[&_button]:border-[#c8bdd6] [&_button]:!bg-[#ded6e7] [&_button]:hover:!bg-[#d4c8e4] [&_button_svg]:!text-[#5d4788] dark:[&_button]:border-[#5a5068] dark:[&_button]:!bg-[#3b3348] dark:[&_button]:hover:!bg-[#463b55] dark:[&_button_svg]:!text-[#fffaff]",
  callsCard:
    "border-[#e2dde8] bg-[#e0d8e8] text-[#1a1820] dark:border-[#1c1921] dark:bg-[#3b3348] dark:text-[#fffaff]",
  cardHover: "hover:bg-[#ded6e7] dark:hover:bg-[#3b3348]",
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
    "border-[#e2dde8] bg-[#e8e2ef] text-[#1a1820] dark:border-[#1c1921] dark:bg-[#342a43] dark:text-[#fffaff]",
  laneTitleBar:
    "border-b border-[#d4c8e4] bg-[#ded6e7] text-[#1a1820] dark:border-[#1c1921] dark:bg-[#272133] dark:text-[#fffaff]",
  sheetEmptyWell: "border-[#e2dde8] bg-[#ece8f2]/90 dark:border-[#1c1921] dark:bg-[#30283c]/40",
  /** Bottom sheets and wide drawers */
  drawerPanel:
    "border-[#e2dde8] bg-[#e8e2ef] text-[#1a1820] dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff]",
  drawerHeader: "bg-[#e4deea] dark:bg-[#181714]",
  tableHeader: "border-[#e2dde8] bg-[#e4deea] dark:border-[#1c1921] dark:bg-[#30283c]",
  tableBody: "bg-[#f5f4f7] dark:bg-[#24231f]",
  navBar: "border-[#e2dde8] bg-[#ece8f2] dark:border-[#1c1921] dark:bg-[#2a2534]",
  toggleShell: "border-[#e2dde8] bg-[#e4deea] dark:border-[#1c1921] dark:bg-[#2a2534]",
  toggleItem:
    "border border-transparent ring-0 data-[state=on]:ring-0 focus-visible:ring-0 text-[#6d6880] hover:bg-[#ded6e7] hover:border-transparent data-[state=on]:!border-[#6b5196] data-[state=on]:!bg-[#6b5196] data-[state=on]:!text-white dark:text-[#ded6e7] dark:hover:bg-[#3b3348] dark:hover:border-transparent dark:data-[state=on]:!border-[#80778e] dark:data-[state=on]:!bg-[#80778e] dark:data-[state=on]:!text-white",
  rowActionButton:
    "border-[#e2dde8] bg-[#e8e2ef] text-[#1a1820] hover:bg-[#ded6e7] active:bg-[#d4cbdf] dark:border-[#1c1921] dark:bg-[#272133] dark:text-[#fffaff] dark:hover:bg-[#3b3348] dark:active:bg-[#463b55]",
  /** Unchecked/checked boxes on tinted todo and form rows */
  checkbox:
    "border-[#8e89a3] bg-[#ffffff] shadow-none data-[state=checked]:border-[#6b5196] data-[state=checked]:bg-[#6b5196] data-[state=checked]:text-white dark:border-[#80778e] dark:bg-[#3b3348] dark:data-[state=checked]:border-[#80778e] dark:data-[state=checked]:bg-[#80778e] dark:data-[state=checked]:text-white",
  checkboxPlaceholder:
    "border-[#8e89a3] bg-[#ffffff] dark:border-[#80778e] dark:bg-[#3b3348]",
  /** Solid circular/pill controls in drawer filter toolbars (Calls, To-Do, BWI). */
  filterToolbarButton:
    "border-[#c8bdd6] !bg-[#ded6e7] !text-[#5d4788] hover:!bg-[#d4c8e4] hover:!text-[#1a1820] active:!bg-[#cbc0db] [&_svg]:!text-[#5d4788] hover:[&_svg]:!text-[#1a1820] dark:border-[#1c1921] dark:!bg-[#3b3348] dark:!text-[#fffaff] dark:hover:!bg-[#463b55] dark:hover:!text-[#fffaff] dark:active:!bg-[#514562] dark:[&_svg]:!text-[#fffaff]",
  filterToolbarButtonActive:
    "border-[#6b5196] !bg-[#6b5196] !text-white hover:!bg-[#5d4788] [&>svg]:!text-white dark:border-[#80778e] dark:!bg-[#80778e] dark:!text-white dark:hover:!bg-[#8c839a] dark:[&>svg]:!text-white",
  drawerHandle:
    "bg-[#6b5196] shadow-[0_0_18px_rgba(107,81,150,0.35)] dark:bg-[#80778e] dark:shadow-[0_0_18px_rgba(128,119,142,0.45)]",
  /**
   * FAB menu — pill chrome (size, shape, subtle lift off scroll content).
   * Elevation lives here so accent fills keep a readable edge.
   */
  fabMenuActionShell:
    "isolate h-auto min-h-11 rounded-full px-4 py-2.5 text-sm font-semibold touch-manipulation ring-1 ring-[#1a1820]/14 dark:ring-[#fffaff]/22 shadow-[0_2px_8px_rgba(26,24,32,0.14),0_0_0_1px_rgba(255,255,255,0.35)_inset] dark:shadow-[0_3px_10px_rgba(0,0,0,0.38),0_0_0_1px_rgba(255,255,255,0.08)_inset]",
  /** FAB menu — primary action (lavender accent; submit). */
  fabMenuPrimary:
    "border border-white/30 !bg-[#6b5196] !text-white hover:!bg-[#5c4685] [&_svg]:!text-white dark:border-white/14 dark:!bg-[#80778e] dark:hover:!bg-[#8c839a] dark:[&_svg]:!text-white",
  /** FAB menu — calls / visits (deeper plum). */
  fabMenuAccentCall:
    "border border-white/30 !bg-[#5d4788] !text-white hover:!bg-[#524379] [&_svg]:!text-white dark:border-white/14 dark:!bg-[#463b55] dark:hover:!bg-[#514562] dark:[&_svg]:!text-white",
  /** FAB menu — to-dos (mid lavender). */
  fabMenuAccentTodo:
    "border border-white/30 !bg-[#6b5196] !text-white hover:!bg-[#5c4685] [&_svg]:!text-white dark:border-white/14 dark:!bg-[#80778e] dark:hover:!bg-[#8c839a] dark:[&_svg]:!text-white",
  /** FAB menu — contacts (soft mauve). */
  fabMenuAccentContact:
    "border border-white/30 !bg-[#7d6b92] !text-white hover:!bg-[#6f6286] [&_svg]:!text-white dark:border-white/14 dark:!bg-[#3b3348] dark:hover:!bg-[#463b55] dark:[&_svg]:!text-white",
  /** FAB menu — establishments (rich purple). */
  fabMenuAccentPlace:
    "border border-white/30 !bg-[#563985] !text-white hover:!bg-[#4c3277] [&_svg]:!text-white dark:border-white/14 dark:!bg-[#342a43] dark:hover:!bg-[#3b3348] dark:[&_svg]:!text-white",
  /** FAB menu — schedules (muted plum). */
  fabMenuAccentSchedule:
    "border border-white/30 !bg-[#5a6b96] !text-white hover:!bg-[#506287] [&_svg]:!text-white dark:border-white/14 dark:!bg-[#272133] dark:hover:!bg-[#30283c] dark:[&_svg]:!text-white",
  /** FAB menu — secondary / outline action (card surface). */
  fabMenuSecondary:
    "border border-[#c8c0d4] !bg-[#e8e2ef] !text-[#1a1820] hover:!bg-[#ded6e7] [&_svg]:!text-[#1a1820] dark:border-[#5a5068] dark:!bg-[#30283c] dark:!text-[#fffaff] dark:hover:!bg-[#3b3348] dark:[&_svg]:!text-[#fffaff]",
  /** FAB menu — destructive action. */
  fabMenuDestructive:
    "border border-white/25 !bg-destructive !text-destructive-foreground hover:!bg-destructive/90 [&_svg]:!text-destructive-foreground dark:border-white/12 dark:!bg-destructive dark:hover:!bg-destructive/90",
  /** FAB menu — warning accent (e.g. bulk Clear). */
  fabMenuClear:
    "border border-[#ca8a04]/40 !bg-yellow-500 !text-gray-950 hover:!bg-yellow-600 [&_svg]:!text-gray-950 dark:border-yellow-300/25 dark:!bg-yellow-500 dark:!text-gray-950 dark:hover:!bg-yellow-400 dark:[&_svg]:!text-gray-950",
  /** FAB main toggle (closed / open). */
  fabMenuMain:
    "ring-1 ring-[#1a1820]/14 dark:ring-[#fffaff]/22 shadow-[0_2px_10px_rgba(26,24,32,0.18)] dark:shadow-[0_3px_12px_rgba(0,0,0,0.4)] !border-0 !bg-[#6b5196] !text-white hover:!bg-[#5c4685] [&_svg]:!text-white dark:!bg-[#80778e] dark:hover:!bg-[#8c839a] dark:[&_svg]:!text-white",
  /** @deprecated Use {@link fabMenuPrimary} */
  bulkFabSubmit:
    "border border-white/30 !bg-[#6b5196] !text-white hover:!bg-[#5c4685] [&_svg]:!text-white dark:border-white/14 dark:!bg-[#80778e] dark:hover:!bg-[#8c839a] dark:[&_svg]:!text-white",
  /** @deprecated Use {@link fabMenuSecondary} */
  bulkFabAdd:
    "border border-[#c8c0d4] !bg-[#e8e2ef] !text-[#1a1820] hover:!bg-[#ded6e7] [&_svg]:!text-[#1a1820] dark:border-[#5a5068] dark:!bg-[#30283c] dark:!text-[#fffaff] dark:hover:!bg-[#3b3348] dark:[&_svg]:!text-[#fffaff]",
  /** Tappable card title bar — same surface as card body (not a contrasting header strip). */
  cardBarHeader:
    "border-[#d4c8e4] bg-[#ded6e7] text-[#1a1820] hover:bg-[#d4c8e4] dark:border-[#1c1921] dark:bg-[#30283c] dark:text-[#fffaff] dark:hover:bg-[#3b3348]",
} as const;

/** Flush segmented toggles — no inner padding; shell overflow clips square items for smooth corners. */
const sectionToggleItemRadius =
  "shadow-none ring-0 outline-none !rounded-none first:!rounded-none last:!rounded-none focus-visible:ring-0 data-[state=on]:ring-0";

/** Phone: borderless section toggle shells and tab items (tablet+ keeps bordered chrome). */
const sectionToggleShellMobile =
  "border-0 md:border md:border-[#e2dde8] md:dark:border-[#1c1921]";
const sectionToggleItemMobileNoBorder =
  "max-md:!border-0 max-md:border-transparent max-md:hover:!border-transparent max-md:data-[state=on]:!border-0 max-md:dark:hover:!border-transparent max-md:dark:data-[state=on]:!border-0";

function joinStudyBibleClasses(...parts: string[]) {
  return parts.filter(Boolean).join(" ");
}

export const studyBibleSectionToggle = {
  shell: joinStudyBibleClasses(
    "relative w-full min-w-0 overflow-hidden rounded-xl shadow-lg bg-[#e4deea] dark:bg-[#30283c]",
    sectionToggleShellMobile
  ),
  shellRow: joinStudyBibleClasses(
    "relative flex w-full min-w-0 items-center overflow-hidden rounded-xl shadow-lg bg-[#e4deea] dark:bg-[#30283c]",
    sectionToggleShellMobile
  ),
  /** Muted track for year/day pickers (single row, scrollable) */
  trackShell: joinStudyBibleClasses(
    "relative w-full overflow-hidden rounded-xl shadow-lg bg-[#e4deea] dark:bg-[#2a2534]",
    sectionToggleShellMobile
  ),
  group: "flex h-full min-h-0 w-full min-w-full gap-0 rounded-none",
  /** Horizontal scroll tabs (members groups): flush left, scroll when overflow. */
  scrollableTabGroup: "w-max min-w-full justify-start",
  /** Fixed-count tabs that evenly fill the shell edge-to-edge (profile sections). */
  filledTabGroup: "w-full",
  filledTabItem: "min-h-12 flex-1 basis-0 !max-w-none py-2",
  item: joinStudyBibleClasses(
    sectionToggleItemRadius,
    sectionToggleItemMobileNoBorder,
    "min-w-0 bg-transparent",
    studyBibleDarkClasses.toggleItem
  ),
  itemIcon:
    "flex h-full min-h-0 flex-1 min-w-0 w-full flex-col items-center justify-center gap-0.5 px-2 py-0 transition-colors",
  itemCompact:
    "flex h-11 min-w-0 items-center justify-center px-3 text-[11px] font-medium transition-colors md:h-12",
  ghostSideButton:
    "flex h-full min-h-0 shrink-0 items-center justify-center self-stretch rounded-none px-3 py-0 transition-colors hover:bg-[#ded6e7] dark:hover:bg-[#3b3348] max-md:border-0 max-md:shadow-none max-md:ring-0 max-md:focus-visible:ring-0",
  /** Embedded card tabs (All / Calls, Upcoming / All) — active tab matches card body surface. */
  cardTabList:
    "relative z-10 mb-0 -mb-px grid h-auto w-full gap-0 border-0 bg-[#e4deea] p-0 dark:bg-[#2a2534] [&>*]:border-0",
  cardTabTrigger:
    "relative h-10 rounded-none rounded-bl-none rounded-br-none border border-transparent px-4 font-medium shadow-none ring-0 outline-none transition-all duration-200 after:hidden focus-visible:outline-none focus-visible:ring-0 bg-[#e4deea] text-[#6d6880] hover:bg-[#ded6e7] hover:text-[#1a1820] hover:border-transparent dark:bg-[#2a2534] dark:text-[#ded6e7] dark:hover:bg-[#342a43] dark:hover:text-[#fffaff] dark:hover:border-transparent data-[state=active]:!border-[#e8e2ef] data-[state=active]:!bg-[#e8e2ef] data-[state=active]:!text-[#1a1820] data-[state=active]:hover:!border-[#e8e2ef] data-[state=active]:hover:!bg-[#e8e2ef] dark:data-[state=active]:!border-[#30283c] dark:data-[state=active]:!bg-[#30283c] dark:data-[state=active]:!text-[#fffaff] dark:data-[state=active]:hover:!border-[#30283c] dark:data-[state=active]:hover:!bg-[#30283c] [&>svg]:text-[#6d6880] hover:[&>svg]:text-[#1a1820] data-[state=active]:[&>svg]:!text-[#1a1820] dark:[&>svg]:text-[#ded6e7] dark:hover:[&>svg]:text-[#fffaff] dark:data-[state=active]:[&>svg]:!text-[#fffaff]",
  cardTabTriggerLeft: "rounded-tl-lg rounded-tr-none",
  cardTabTriggerRight: "rounded-tr-lg rounded-tl-none",
  cardTabContent: "mt-0 rounded-b-lg p-4 bg-transparent dark:bg-transparent",
  /** Active embedded tab — set `--study-card-shade` / `--study-card-shade-dark` on the card shell. */
  cardTabActiveFromShell:
    "data-[state=active]:!border-[var(--study-card-shade)] data-[state=active]:!bg-[var(--study-card-shade)] data-[state=active]:!text-[#1a1820] data-[state=active]:hover:!border-[var(--study-card-shade)] data-[state=active]:hover:!bg-[var(--study-card-shade)] data-[state=active]:[&>svg]:!text-[#1a1820] dark:data-[state=active]:!border-[var(--study-card-shade-dark)] dark:data-[state=active]:!bg-[var(--study-card-shade-dark)] dark:data-[state=active]:!text-[#fffaff] dark:data-[state=active]:hover:!border-[var(--study-card-shade-dark)] dark:data-[state=active]:hover:!bg-[var(--study-card-shade-dark)] dark:data-[state=active]:[&>svg]:!text-[#fffaff]",
} as const;

const studyBibleLightCardShadeClasses = [
  "bg-[#e8e2ef]",
  "bg-[#ece8f2]",
  "bg-[#e4deea]",
  "bg-[#e0d8e8]",
  "bg-[#ded6e7]",
  "bg-[#d4cbdf]",
] as const;

/** Light-mode card hex values — keep in sync with {@link studyBibleLightCardShadeClasses}. */
export const studyBibleLightCardShadeHex = [
  "#e8e2ef",
  "#ece8f2",
  "#e4deea",
  "#e0d8e8",
  "#ded6e7",
  "#d4cbdf",
] as const;

const studyBibleDarkCardShadeClasses = [
  "dark:bg-[#30283c]",
  "dark:bg-[#342a43]",
  "dark:bg-[#3b3348]",
  "dark:bg-[#2a2534]",
  "dark:bg-[#272133]",
  "dark:bg-[#463b55]",
] as const;

/** Dark-mode card hex values — keep in sync with {@link studyBibleDarkCardShadeClasses}. */
export const studyBibleDarkCardShadeHex = [
  "#30283c",
  "#342a43",
  "#3b3348",
  "#2a2534",
  "#272133",
  "#463b55",
] as const;

const studyBibleLightCardFadeClasses = [
  "from-[#e8e2ef] via-[#e8e2ef]/50",
  "from-[#ece8f2] via-[#ece8f2]/50",
  "from-[#e4deea] via-[#e4deea]/50",
  "from-[#e0d8e8] via-[#e0d8e8]/50",
  "from-[#ded6e7] via-[#ded6e7]/50",
  "from-[#d4cbdf] via-[#d4cbdf]/50",
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

export function getStudyBibleLightCardShadeHex(key: string) {
  return studyBibleLightCardShadeHex[getStablePaletteIndex(key, studyBibleLightCardShadeHex.length)];
}

/** Fixed palette slots — adjacent home cards use spread indices for distinct tints. */
export const studyBibleHomeCardShadeSlots = {
  hoursSummary: 0,
  todo: 4,
  bwiCallsTabs: 5,
  bwiSummary: 3,
  calls: 4,
} as const;

export type StudyBibleHomeCardShadeSlot = keyof typeof studyBibleHomeCardShadeSlots;

function getStudyBibleCardShadeByIndex(index: number) {
  const normalized =
    ((index % studyBibleLightCardShadeClasses.length) + studyBibleLightCardShadeClasses.length) %
    studyBibleLightCardShadeClasses.length;
  return `${studyBibleLightCardShadeClasses[normalized]} ${studyBibleDarkCardShadeClasses[normalized]}`;
}

export function getStudyBibleHomeCardShade(slot: StudyBibleHomeCardShadeSlot) {
  return getStudyBibleCardShadeByIndex(studyBibleHomeCardShadeSlots[slot]);
}

export function getStudyBibleHomeCardShadeHex(slot: StudyBibleHomeCardShadeSlot) {
  return studyBibleLightCardShadeHex[studyBibleHomeCardShadeSlots[slot]];
}

export function getStudyBibleHomeCardDarkShadeHex(slot: StudyBibleHomeCardShadeSlot) {
  return studyBibleDarkCardShadeHex[studyBibleHomeCardShadeSlots[slot]];
}

/** Inactive tab track — offset from body for contrast (light mode). */
export function getStudyBibleHomeCardTabTrackHex(slot: StudyBibleHomeCardShadeSlot) {
  const slotIndex = studyBibleHomeCardShadeSlots[slot];
  const trackIndex = (slotIndex + 3) % studyBibleLightCardShadeHex.length;
  return studyBibleLightCardShadeHex[trackIndex];
}

/** Congregation page — spread palette slots so adjacent cards differ in light mode. */
export const studyBibleCongregationCardShadeSlots = {
  meetings: 0,
  members: 2,
  ministryToday: 4,
  ministryContacts: 1,
  ministryAssignments: 3,
  events: 5,
} as const;

export type StudyBibleCongregationCardShadeSlot = keyof typeof studyBibleCongregationCardShadeSlots;

export function getStudyBibleCongregationCardShade(slot: StudyBibleCongregationCardShadeSlot) {
  return getStudyBibleCardShadeByIndex(studyBibleCongregationCardShadeSlots[slot]);
}

export function getStudyBibleCongregationCardShadeHex(slot: StudyBibleCongregationCardShadeSlot) {
  return studyBibleLightCardShadeHex[studyBibleCongregationCardShadeSlots[slot]];
}

export function getStudyBibleCongregationCardDarkShadeHex(slot: StudyBibleCongregationCardShadeSlot) {
  return studyBibleDarkCardShadeHex[studyBibleCongregationCardShadeSlots[slot]];
}

export function getStudyBibleCongregationCardTabTrackHex(slot: StudyBibleCongregationCardShadeSlot) {
  const slotIndex = studyBibleCongregationCardShadeSlots[slot];
  const trackIndex = (slotIndex + 3) % studyBibleLightCardShadeHex.length;
  return studyBibleLightCardShadeHex[trackIndex];
}

export function getStudyBibleDarkCardFade(key: string) {
  const index = getStablePaletteIndex(key, studyBibleLightCardFadeClasses.length);
  return `${studyBibleLightCardFadeClasses[index]} ${studyBibleDarkCardFadeClasses[index]}`;
}

export type FabMenuActionSurfaceInput = {
  label?: string;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost" | "link";
  className?: string;
};

const FAB_MENU_ACCENT_VARIANTS = [
  studyBibleDarkClasses.fabMenuAccentCall,
  studyBibleDarkClasses.fabMenuAccentTodo,
  studyBibleDarkClasses.fabMenuAccentContact,
  studyBibleDarkClasses.fabMenuAccentPlace,
  studyBibleDarkClasses.fabMenuAccentSchedule,
] as const;

/** Stable per-label accent; semantic keywords first, then hashed palette slot. */
function resolveFabMenuLabelAccent(label: string): string {
  const normalized = label.trim().toLowerCase();

  if (normalized.includes("submit ready")) {
    return studyBibleDarkClasses.fabMenuPrimary;
  }
  if (normalized.includes("add another to-do")) {
    return studyBibleDarkClasses.fabMenuSecondary;
  }
  if (normalized.includes("schedule")) {
    return studyBibleDarkClasses.fabMenuAccentSchedule;
  }
  if (normalized.includes("establishment")) {
    return studyBibleDarkClasses.fabMenuAccentPlace;
  }
  if (
    normalized.includes("contact") ||
    normalized.includes("householder") ||
    normalized.includes("publisher")
  ) {
    return studyBibleDarkClasses.fabMenuAccentContact;
  }
  if (normalized.includes("to-do") || normalized.includes("todos")) {
    return studyBibleDarkClasses.fabMenuAccentTodo;
  }
  if (
    normalized.includes("call") ||
    normalized.includes("field service") ||
    normalized.includes("visit")
  ) {
    return studyBibleDarkClasses.fabMenuAccentCall;
  }

  return FAB_MENU_ACCENT_VARIANTS[getStablePaletteIndex(label, FAB_MENU_ACCENT_VARIANTS.length)];
}

/** Resolves FAB menu pill surface colors from action variant or explicit className. */
export function resolveFabMenuActionSurface(action: FabMenuActionSurfaceInput): string {
  if (action.className) return action.className;
  if (action.variant === "destructive" || action.label === "Delete All") {
    return studyBibleDarkClasses.fabMenuDestructive;
  }
  if (action.label === "Clear") {
    return studyBibleDarkClasses.fabMenuClear;
  }
  if (action.label) {
    return resolveFabMenuLabelAccent(action.label);
  }
  if (action.variant === "outline" || action.variant === "secondary") {
    return studyBibleDarkClasses.fabMenuSecondary;
  }
  return studyBibleDarkClasses.fabMenuAccentTodo;
}
