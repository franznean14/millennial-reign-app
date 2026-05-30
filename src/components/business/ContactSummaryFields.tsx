import { cn } from "@/lib/utils";

interface ContactSummaryFieldsProps {
  /** Establishment area when linked (BWI contacts). */
  area?: string | null;
  note?: string | null;
  /** When false, hide area even if present (congregation personal contacts). */
  showArea?: boolean;
  className?: string;
}

/** Fluid two-column grid for contact/contact summary cards (drawers, details panels). */
export function ContactSummaryFields({
  area,
  note,
  showArea = true,
  className,
}: ContactSummaryFieldsProps) {
  const areaText = showArea ? area?.trim() ?? "" : "";
  const noteText = note?.trim() ?? "";

  const fields: Array<{ key: string; label: string; value: string }> = [];
  if (areaText) fields.push({ key: "area", label: "Area", value: areaText });
  if (noteText) fields.push({ key: "note", label: "Note", value: noteText });

  if (fields.length === 0) return null;

  return (
    <div className={cn("grid grid-cols-2 gap-4", className)}>
      {fields.map((field, index) => (
        <div
          key={field.key}
          className={cn(fields.length % 2 === 1 && index === fields.length - 1 && "col-span-2")}
        >
          <p className="text-sm font-medium text-muted-foreground">{field.label}</p>
          <p className={cn("break-words", field.key === "note" && "text-sm")}>{field.value}</p>
        </div>
      ))}
    </div>
  );
}

/** Loading placeholder matching {@link ContactSummaryFields} two-column layout. */
export function ContactSummaryFieldsSkeleton({
  showArea = true,
  className,
}: {
  showArea?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-4", className)}>
      {showArea ? (
        <div>
          <div className="mb-2 h-3 w-12 animate-pulse rounded bg-muted/60" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted/60" />
        </div>
      ) : null}
      <div className={showArea ? undefined : "col-span-2"}>
        <div className="mb-2 h-3 w-14 animate-pulse rounded bg-muted/60" />
        <div className="h-4 max-w-[300px] animate-pulse rounded bg-muted/60" />
        <div className="mt-2 h-4 max-w-[200px] animate-pulse rounded bg-muted/60" />
      </div>
    </div>
  );
}
