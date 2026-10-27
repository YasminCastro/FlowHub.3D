"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { FlushPairForm } from "@/components/flushing/flush-pair-form";
import { usePageHeaderBreadcrumb } from "@/contexts/page-header-action-context";
import { FlushPairInput, createFlushPair } from "@/lib/api/flushing";

export default function NewFlushPairPage() {
  const router = useRouter();

  usePageHeaderBreadcrumb(
    <>
      <Link
        href="/dashboard/flushing"
        className="text-muted-foreground hover:text-foreground"
      >
        Flushing
      </Link>
      <ChevronRight
        className="size-3.5 text-muted-foreground"
        aria-hidden="true"
      />
      <span className="font-medium">Novo flushing</span>
    </>,
  );

  async function handleSubmit(input: FlushPairInput) {
    await createFlushPair(input);
    router.push("/dashboard/flushing");
  }

  return <FlushPairForm onSubmit={handleSubmit} />;
}
