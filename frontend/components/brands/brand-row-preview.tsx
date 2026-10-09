import { Badge } from "@/components/ui/badge";
import {
  BRAND_STATUS_LABELS,
  BrandStatus,
  COST_BENEFIT_LABELS,
  CostBenefit,
  ResearchedPrice,
  formatResearchedRange,
} from "@/lib/api/brand";
import { cn, formatBRL } from "@/lib/utils";

export function BrandStatusBadge({ status }: { status: BrandStatus }) {
  return (
    <Badge variant={status === "PURCHASED" ? "default" : "secondary"}>
      {BRAND_STATUS_LABELS[status]}
    </Badge>
  );
}

export function FilamentTypeTags({ types }: { types: string[] }) {
  if (types.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {types.map((type) => (
        <span
          key={type}
          className="rounded-sm border border-border px-1.5 py-0.5 text-[11px] whitespace-nowrap text-muted-foreground"
        >
          {type}
        </span>
      ))}
    </div>
  );
}

const COST_BENEFIT_STYLES: Record<CostBenefit, string> = {
  GOOD: "bg-emerald-500/15 text-emerald-400",
  MODERATE: "bg-amber-500/15 text-amber-400",
  HIGH: "bg-destructive/15 text-destructive",
};

export function CostBenefitBadge({
  costBenefit,
}: {
  costBenefit: CostBenefit | null;
}) {
  if (!costBenefit) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <Badge className={COST_BENEFIT_STYLES[costBenefit]}>
      {COST_BENEFIT_LABELS[costBenefit]}
    </Badge>
  );
}

// Por enquanto o único preço por kg é o pesquisado; o dos rolos vem depois.
export function BrandPricePerKg({
  researchedPrice,
  align = "left",
}: {
  researchedPrice: ResearchedPrice | null;
  align?: "left" | "right";
}) {
  return (
    <div className={cn("flex flex-col", align === "right" && "items-end")}>
      {researchedPrice ? (
        <>
          <span className="font-medium">
            {formatBRL(researchedPrice.average)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            pesquisado · {formatResearchedRange(researchedPrice)}
          </span>
        </>
      ) : (
        <>
          <span className="text-muted-foreground">—</span>
          <span className="text-[11px] text-muted-foreground">
            sem rolo cadastrado
          </span>
        </>
      )}
    </div>
  );
}

export function BrandRowPreview({
  name,
  status,
  filamentTypes,
  researchedPrice,
  costBenefit,
}: {
  name: string;
  status: BrandStatus;
  filamentTypes: string[];
  researchedPrice: ResearchedPrice | null;
  costBenefit: CostBenefit | null;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="truncate font-heading text-sm font-medium">
          {name.trim() || "Nome da marca"}
        </span>
        <BrandStatusBadge status={status} />
      </div>
      <FilamentTypeTags types={filamentTypes} />
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground uppercase tracking-wide">
            Preço por kg
          </span>
          <BrandPricePerKg researchedPrice={researchedPrice} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground uppercase tracking-wide">
            Custo
          </span>
          <CostBenefitBadge costBenefit={costBenefit} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground uppercase tracking-wide">
            Avaliação
          </span>
          <span className="text-muted-foreground">— sem uso</span>
        </div>
      </div>
    </div>
  );
}
