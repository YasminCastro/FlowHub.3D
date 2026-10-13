import Link from "next/link";

import { FilamentDot } from "@/components/journal/journal-status-badge";
import {
  JOURNAL_STATUS_LABELS,
  JournalEntry,
  formatOrdinal,
  getWinningAttemptIndex,
} from "@/lib/api/journal";
import { cn, formatDatePtBR } from "@/lib/utils";

function describe(entry: JournalEntry) {
  const date = formatDatePtBR(entry.occurredAt, {
    day: "2-digit",
    month: "2-digit",
  });
  const winnerIndex = getWinningAttemptIndex(entry);
  if (winnerIndex >= 0) {
    return `resolvido na ${formatOrdinal(winnerIndex + 1)} · ${date}`;
  }
  return `${JOURNAL_STATUS_LABELS[entry.status].toLowerCase()} · ${date}`;
}

export function JournalSimilarEntries({
  entries,
}: {
  entries: JournalEntry[];
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        Entradas parecidas
      </span>
      {entries.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">
          Nenhuma entrada parecida ainda.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {entries.map((entry) => (
            <Link
              key={entry.id}
              href={`/dashboard/diario/${entry.id}`}
              className="group flex items-center gap-2.5"
            >
              <FilamentDot colors={entry.filament?.colors ?? []} />
              <div className="min-w-0">
                <div className="truncate text-[12.5px] group-hover:text-brand">
                  {entry.title}
                </div>
                <div
                  className={cn(
                    "text-[10.5px]",
                    entry.status === "RESOLVED"
                      ? "text-brand-300"
                      : "text-muted-foreground",
                  )}
                >
                  {describe(entry)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
