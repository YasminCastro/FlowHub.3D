"use client";

import {
  CopyPlus,
  GitBranch,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { Fragment, KeyboardEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilamentDot } from "@/components/journal/journal-status-badge";
import {
  FAILURE_COLOR,
  OutcomeIcon,
  SectionLabel,
} from "@/components/prints/print-bits";
import {
  PrintRecord,
  CostContext,
  computeCost,
  costRows,
  describePrintFilament,
  formatDuration,
  formatGrams,
  formatSettings,
  getRecordGrams,
} from "@/lib/api/print";
import { cn, formatBRL, formatDatePtBR } from "@/lib/utils";

const COLUMNS =
  "grid-cols-[22px_88px_minmax(150px,1.25fr)_100px_56px_66px_70px_minmax(150px,1.5fr)_84px_28px]";

function whatChanged(record: PrintRecord, isDefault: boolean) {
  if (record.outcome === "FAILURE") return record.failureReason ?? "Falha";
  return [record.note, isDefault ? null : record.changeSummary]
    .filter(Boolean)
    .join(" · ");
}

function RecordDetails({
  record,
  costs,
}: {
  record: PrintRecord;
  costs: CostContext;
}) {
  const cost = computeCost(record, costs);
  const s = record.settings;
  return (
    <div className="grid grid-cols-1 gap-5 border-b border-border/60 bg-foreground/[0.025] py-4 pr-4 pl-8.5 sm:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Configuração</SectionLabel>
        <p className="text-[12.5px] leading-relaxed text-foreground/72">
          {record.printer.name}
          {s ? ` · ${s.slicer}` : ""}
          <br />
          {s ? formatSettings(s) : "Sem configuração do fatiador"}
          {s?.extras && (
            <>
              <br />
              {s.extras}
            </>
          )}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <SectionLabel>Filamentos</SectionLabel>
        {record.filaments.map((usage) => (
          <div
            key={usage.filament.id}
            className="flex items-center gap-2 text-[12.5px] text-foreground/72"
          >
            <FilamentDot colors={usage.filament.colors} />
            {describePrintFilament(usage.filament)} · {usage.filament.brandName}
            <span className="ml-auto tabular-nums">
              {formatGrams(usage.grams)}
            </span>
          </div>
        ))}
        {record.note && (
          <p className="mt-1 text-[12px] text-muted-foreground">
            {record.note}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <SectionLabel>
          {record.outcome === "FAILURE" ? "Custo perdido" : "Custo"}
        </SectionLabel>
        <div className="flex flex-col gap-1 text-[12px] text-muted-foreground tabular-nums">
          {costRows(cost, costs).map(([label, value]) => (
            <div key={label} className="flex">
              <span>{label}</span>
              <span className="ml-auto">{formatBRL(value)}</span>
            </div>
          ))}
        </div>
        {record.photos.length > 0 && (
          <div className="mt-1.5 flex gap-1.5">
            {record.photos.map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.id}
                src={photo.src}
                alt=""
                className="size-12 rounded-sm object-cover"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function PrintRecordsTable({
  records,
  costs,
  defaultRecordId,
  onMakeDefault,
  onStartFrom,
  onDerive,
  onEdit,
  onDelete,
}: {
  records: PrintRecord[];
  costs: CostContext;
  defaultRecordId: string;
  onMakeDefault: (record: PrintRecord) => void;
  onStartFrom: (record: PrintRecord) => void;
  onDerive: (record: PrintRecord) => void;
  onEdit: (record: PrintRecord) => void;
  onDelete: (record: PrintRecord) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  function toggle(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  function onRowKeyDown(e: KeyboardEvent, id: string) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(id);
    }
  }

  const cell = "text-[13px] tabular-nums";

  return (
    <div className="overflow-x-auto">
      <div className="min-w-220">
        <div
          className={cn(
            "grid items-center gap-4 border-b border-border/60 py-2",
            COLUMNS,
          )}
        >
          <span />
          <SectionLabel>Data</SectionLabel>
          <SectionLabel>Filamento</SectionLabel>
          <SectionLabel>Impressora</SectionLabel>
          <SectionLabel>Qtd.</SectionLabel>
          <SectionLabel>Gramas</SectionLabel>
          <SectionLabel>Tempo</SectionLabel>
          <SectionLabel>O que mudou</SectionLabel>
          <SectionLabel className="text-right">Custo</SectionLabel>
          <span />
        </div>

        {records.map((record) => {
          const isFailure = record.outcome === "FAILURE";
          const isDefault = record.id === defaultRecordId;
          const isOpen = openId === record.id;
          const total = computeCost(record, costs).total;
          const [first, ...others] = record.filaments;

          return (
            <Fragment key={record.id}>
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onClick={() => toggle(record.id)}
                onKeyDown={(e) => onRowKeyDown(e, record.id)}
                className={cn(
                  "grid cursor-pointer items-center gap-4 border-b border-border/60 py-2.75 transition-colors hover:bg-foreground/[0.04] focus-visible:outline-2 focus-visible:outline-brand",
                  COLUMNS,
                  isFailure && "bg-[#d97a7a]/5",
                  isDefault && "bg-brand/6",
                  isOpen && "bg-foreground/[0.04]",
                )}
              >
                <OutcomeIcon outcome={record.outcome} />
                <span className="text-[12.5px] text-muted-foreground tabular-nums">
                  {formatDatePtBR(record.printedAt)}
                </span>
                <span className="flex min-w-0 items-center gap-1.75 text-[13px]">
                  {first && <FilamentDot colors={first.filament.colors} />}
                  <span className="truncate">
                    {first
                      ? `${describePrintFilament(first.filament)} · ${first.filament.brandName}`
                      : "—"}
                  </span>
                  {others.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      +{others.length}
                    </span>
                  )}
                </span>
                <span className="truncate text-[12.5px] text-foreground/72">
                  {record.printer.name}
                </span>
                <span className={cell}>{record.units} un.</span>
                <span className={cell}>
                  {formatGrams(getRecordGrams(record))}
                </span>
                <span className={cn(cell, "text-foreground/72")}>
                  {formatDuration(record.totalMinutes)}
                </span>
                <span
                  className={cn(
                    "flex min-w-0 items-center gap-1.75 text-[12.5px]",
                    isDefault ? "text-brand-300" : "text-muted-foreground",
                  )}
                  style={isFailure ? { color: FAILURE_COLOR } : undefined}
                >
                  {isDefault && (
                    <Star
                      className="size-3 shrink-0 fill-current"
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate">
                    {isDefault
                      ? ["Padrão", whatChanged(record, true)]
                          .filter(Boolean)
                          .join(" · ")
                      : whatChanged(record, false) || "—"}
                  </span>
                </span>
                <span
                  className={cn(cell, "text-right")}
                  style={isFailure ? { color: FAILURE_COLOR } : undefined}
                >
                  {isFailure ? `−${formatBRL(total)}` : formatBRL(total)}
                </span>
                {/* O menu abre em portal, mas os eventos ainda sobem pela
                    árvore do React: barra aqui para não abrir/fechar a linha. */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Ações do registro"
                          className="text-muted-foreground"
                        >
                          <MoreHorizontal />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-60">
                      <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => onEdit(record)}>
                          <Pencil />
                          Editar registro
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isDefault || isFailure}
                          onClick={() => onMakeDefault(record)}
                        >
                          <Star />
                          Marcar como padrão
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onStartFrom(record)}>
                          <CopyPlus />
                          Novo registro a partir deste
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDerive(record)}>
                          <GitBranch />
                          Criar derivado a partir dele
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDelete(record)}
                        >
                          <Trash2 />
                          Excluir registro
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {isOpen && <RecordDetails record={record} costs={costs} />}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
