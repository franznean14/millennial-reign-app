import { studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";

export const sidebarFormClasses = {
  form: "dark:text-[#fffaff]",
  label: "dark:text-[#ded6e7]",
  staticField: "border border-transparent bg-muted text-sm dark:border-[#1c1921] dark:bg-[#2a2534] dark:text-[#fffaff]",
  input:
    "dark:border-[#5a5068] dark:bg-[#2a2534] dark:text-[#fffaff] dark:placeholder:text-[#ded6e7]/70 dark:focus-visible:ring-[#80778e]",
  selectTrigger:
    "dark:border-[#5a5068] dark:bg-[#2a2534] dark:text-[#fffaff] dark:focus:ring-[#80778e]",
  selectContent: studyBibleDarkClasses.popoverPanel,
  textarea:
    "dark:border-[#5a5068] dark:bg-[#2a2534] dark:text-[#fffaff] dark:placeholder:text-[#ded6e7]/70 dark:focus-visible:ring-[#80778e]",
  chip: "dark:border-[#1c1921] dark:bg-[#2a2534] dark:text-[#fffaff]",
  button:
    "dark:border-[#1c1921] dark:bg-[#30283c] dark:text-[#fffaff] dark:hover:bg-[#3b3348]",
  primaryButton: "dark:bg-[#80778e] dark:text-white dark:hover:bg-[#8c839a]",
  popover: studyBibleDarkClasses.popoverPanel,
  panel: "dark:border-[#1c1921] dark:bg-[#2a2534] dark:text-[#fffaff]",
} as const;
