import { studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";

export const sidebarFormClasses = {
  form: "text-foreground dark:text-[#fffaff]",
  label: studyBibleDarkClasses.muted,
  staticField:
    "border border-transparent bg-muted text-sm text-foreground dark:border-[#1c1921] dark:bg-[#2a2534] dark:text-[#fffaff]",
  input:
    "border-[#e2dde8] bg-[#ffffff] text-[#1a1820] placeholder:text-[#8e89a3] focus-visible:ring-[#6b5196] dark:border-[#5a5068] dark:bg-[#2a2534] dark:text-[#fffaff] dark:placeholder:text-[#ded6e7]/70 dark:focus-visible:ring-[#80778e]",
  selectTrigger:
    "border-[#e2dde8] bg-[#ffffff] text-[#1a1820] focus:ring-[#6b5196] dark:border-[#5a5068] dark:bg-[#2a2534] dark:text-[#fffaff] dark:focus:ring-[#80778e]",
  selectContent: studyBibleDarkClasses.popoverPanel,
  textarea:
    "border-[#e2dde8] bg-[#ffffff] text-[#1a1820] placeholder:text-[#8e89a3] focus-visible:ring-[#6b5196] dark:border-[#5a5068] dark:bg-[#2a2534] dark:text-[#fffaff] dark:placeholder:text-[#ded6e7]/70 dark:focus-visible:ring-[#80778e]",
  chip: "border-[#e2dde8] bg-[#faf8fc] text-[#1a1820] dark:border-[#1c1921] dark:bg-[#2a2534] dark:text-[#fffaff]",
  button:
    "border-[#e2dde8] bg-[#ffffff] text-[#1a1820] hover:bg-[#ece8f2] dark:border-[#1c1921] dark:bg-[#30283c] dark:text-[#fffaff] dark:hover:bg-[#3b3348]",
  primaryButton: "bg-[#6b5196] text-white hover:bg-[#5c4685] dark:bg-[#80778e] dark:text-white dark:hover:bg-[#8c839a]",
  popover: studyBibleDarkClasses.popoverPanel,
  panel: studyBibleDarkClasses.todoCard,
} as const;
