/** Hide #fab-root while FormModal call/to-do sheets are open (ref-counted across all mounted modals). */

type Listener = () => void;

let suppressCount = 0;
const listeners = new Set<Listener>();

export function getFabFormSheetSuppressCount(): number {
  return suppressCount;
}

export function subscribeFabFormSheetSuppress(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyFabFormSheetSuppressListeners() {
  listeners.forEach((listener) => listener());
}

function syncFabRootDom() {
  if (typeof document === "undefined") return;
  const fabRoot = document.getElementById("fab-root");
  if (!fabRoot) return;

  if (suppressCount > 0) {
    fabRoot.setAttribute("inert", "");
    fabRoot.setAttribute("data-form-modal-suppressed", "");
    fabRoot.style.display = "none";
  } else {
    fabRoot.removeAttribute("inert");
    fabRoot.removeAttribute("data-form-modal-suppressed");
    fabRoot.style.removeProperty("display");
  }
}

/** Call the returned function to release (typically from useEffect cleanup). */
export function incrementFabFormSheetSuppress(): () => void {
  suppressCount += 1;
  syncFabRootDom();
  notifyFabFormSheetSuppressListeners();
  return () => {
    suppressCount = Math.max(0, suppressCount - 1);
    syncFabRootDom();
    notifyFabFormSheetSuppressListeners();
  };
}
