"use client";

import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Building2, FilePlus2, X, UserPlus } from "lucide-react";
import { useSPA } from "@/components/SPAProvider";

function FloatButtonContent() {
  const { currentSection, userPermissions } = useSPA();
  const [businessExpanded, setBusinessExpanded] = useState(false);

  // Business floating actions
  if (currentSection === "business" && userPermissions.showBusiness) {
    return (
      <>
        <Button
          onClick={() => setBusinessExpanded(!businessExpanded)}
          className={`fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:bottom-[104px] ${
            businessExpanded ? 'rotate-45' : ''
          }`}
          size="lg"
        >
          {businessExpanded ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>

        <div className={`fixed right-4 z-40 flex flex-col gap-2 transition-all duration-300 ease-out items-end bottom-[calc(max(env(safe-area-inset-bottom),0px)+144px)] md:right-6 md:bottom-[168px] ${
          businessExpanded 
            ? 'opacity-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}>
          <Button
            variant="outline"
            className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => { window.dispatchEvent(new CustomEvent('drawer:est:open')); setBusinessExpanded(false); }}
          >
            <Building2 className="h-4 w-4 mr-2"/>
            Establishment
          </Button>
          <Button
            variant="outline"
            className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => { window.dispatchEvent(new CustomEvent('drawer:hh:open')); setBusinessExpanded(false); }}
          >
            <UserPlus className="h-4 w-4 mr-2"/>
            Householder
          </Button>
          <Button
            variant="default"
            className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => { window.dispatchEvent(new CustomEvent('drawer:visit:open')); setBusinessExpanded(false); }}
          >
            <FilePlus2 className="h-4 w-4 mr-2"/>
            Visit
          </Button>
        </div>
      </>
    );
  }

  // Home FAB
  if (currentSection === "home") {
    return (
      <>
        <Button
          onClick={() => { window.dispatchEvent(new CustomEvent('drawer:home:open')); }}
          className="fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:bottom-[104px]"
          size="lg"
        >
          <FilePlus2 className="h-6 w-6" />
        </Button>
      </>
    );
  }

  return null;
}

export function FloatButton() {
  return (
    <Suspense fallback={null}>
      <FloatButtonContent />
    </Suspense>
  );
}


