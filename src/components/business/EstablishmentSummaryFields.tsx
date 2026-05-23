import { cn } from "@/lib/utils";

interface EstablishmentSummaryFieldsProps {
  area?: string | null;
  description?: string | null;
  floor?: string | null;
  note?: string | null;
  /** Truncate long notes in summary cards (full text remains in edit form). */
  noteMaxLength?: number;
  className?: string;
}

/** Fluid two-column grid for establishment summary cards (drawers, details panels). */
export function EstablishmentSummaryFields({
  area,
  description,
  floor,
  note,
  noteMaxLength = 100,
  className,
}: EstablishmentSummaryFieldsProps) {
  const areaText = area?.trim() ?? "";
  const descriptionText = description?.trim() ?? "";
  const floorText = floor?.trim() ?? "";
  const noteRaw = note?.trim() ?? "";
  const noteText =
    noteRaw.length > noteMaxLength ? `${noteRaw.slice(0, noteMaxLength)}…` : noteRaw;

  const fields: Array<{ key: string; label: string; value: string }> = [];
  if (areaText) fields.push({ key: "area", label: "Area", value: areaText });
  if (descriptionText) fields.push({ key: "description", label: "Description", value: descriptionText });
  if (floorText) fields.push({ key: "floor", label: "Floor", value: floorText });
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
