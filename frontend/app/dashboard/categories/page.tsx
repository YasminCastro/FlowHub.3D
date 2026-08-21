"use client";

import {
  ArrowUpDown,
  EyeOff,
  Filter,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api/auth";
import {
  Category,
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "@/lib/api/category";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PRESET_COLORS = [
  "#e0575b",
  "#e08a3c",
  "#e0c23c",
  "#7fb35c",
  "#4ba394",
  "#4c8fd1",
  "#7c6de0",
  "#c15fc0",
  "#8a8f98",
];

const categorySchema = z.object({
  name: z.string().min(1, "Informe o nome da categoria."),
  color: z.string().min(1, "Escolha uma cor."),
});

type CategoryValues = z.infer<typeof categorySchema>;

type SortOption =
  | "usage-desc"
  | "usage-asc"
  | "name-asc"
  | "name-desc"
  | "created-desc";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "usage-desc", label: "Mais usadas" },
  { value: "usage-asc", label: "Menos usadas" },
  { value: "name-asc", label: "Nome (A–Z)" },
  { value: "name-desc", label: "Nome (Z–A)" },
  { value: "created-desc", label: "Criadas recentemente" },
];

// Dados mockados até a API expor contagem de impressões por categoria.
const MOCK_CATEGORY_USAGE = [
  { name: "Home Office", color: "#7fb35c", count: 5 },
  { name: "Chaveiro", color: "#e08a3c", count: 3 },
  { name: "Decoração", color: "#4ba394", count: 3 },
  { name: "Brinquedos", color: "#a3c14a", count: 2 },
  { name: "Bijuterias", color: "#e0399e", count: 2 },
  { name: "Ferramentas", color: "#e0b23c", count: 2 },
  { name: "Suportes", color: "#4c8fd1", count: 2 },
  { name: "Cosplay", color: "#e0575b", count: 2 },
  { name: "Miniaturas", color: "#e06a3c", count: 1 },
  { name: "Jardim", color: "#9ac14a", count: 1 },
  { name: "Jogos", color: "#7c6de0", count: 1 },
];
const MOCK_WITHOUT_CATEGORY = 3;

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("usage-desc");
  const [hideWithoutPrints, setHideWithoutPrints] = useState(false);
  const [onlyInUse, setOnlyInUse] = useState(false);

  const newCategoryNameRef = useRef<HTMLInputElement>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(PRESET_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [deletingCategory, setDeletingCategory] = useState<Category | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const form = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", color: PRESET_COLORS[0] },
  });

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setIsLoading(true);
    setLoadError(null);
    try {
      setCategories(await listCategories());
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível carregar as categorias.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateCategory(name: string, color: string) {
    setIsCreating(true);
    setCreateError(null);
    try {
      const created = await createCategory(name, color);
      setCategories((prev) => [...prev, created]);
      setNewCategoryName("");
      setNewCategoryColor(PRESET_COLORS[0]);
    } catch (err) {
      setCreateError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível criar a categoria.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  function openEditDialog(category: Category) {
    setEditingCategory(category);
    setFormError(null);
    form.reset({ name: category.name, color: category.color });
    setIsFormOpen(true);
  }

  function onFormOpenChange(open: boolean) {
    setIsFormOpen(open);
    if (!open) form.reset();
  }

  async function onSubmitCategory(values: CategoryValues) {
    if (!editingCategory) return;
    setFormError(null);
    try {
      const updated = await updateCategory(
        editingCategory.id,
        values.name,
        values.color,
      );
      setCategories((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      );
      setIsFormOpen(false);
      form.reset();
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível salvar a categoria.",
      );
    }
  }

  function onDeleteDialogOpenChange(open: boolean) {
    if (!open) {
      setDeletingCategory(null);
      setDeleteError(null);
    }
  }

  async function confirmDeleteCategory() {
    if (!deletingCategory) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteCategory(deletingCategory.id);
      setCategories((prev) => prev.filter((c) => c.id !== deletingCategory.id));
      setDeletingCategory(null);
    } catch (err) {
      setDeleteError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível excluir a categoria.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  const isSubmitting = form.formState.isSubmitting;

  const visibleCategories = categories
    .filter((category) =>
      category.name.toLowerCase().includes(search.trim().toLowerCase()),
    )
    .sort((a, b) => {
      switch (sortOption) {
        case "name-asc":
          return a.name.localeCompare(b.name, "pt-BR");
        case "name-desc":
          return b.name.localeCompare(a.name, "pt-BR");
        case "created-desc":
          return categories.indexOf(b) - categories.indexOf(a);
        default:
          return 0;
      }
    });

  const activeSortLabel = SORT_OPTIONS.find(
    (option) => option.value === sortOption,
  )?.label;

  const categorizedTotal = MOCK_CATEGORY_USAGE.reduce(
    (sum, item) => sum + item.count,
    0,
  );
  const overallTotal = categorizedTotal + MOCK_WITHOUT_CATEGORY;
  const [topCategory, secondCategory] = MOCK_CATEGORY_USAGE;

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Categorias</h1>
          <p className="text-muted-foreground text-sm">
            Nome e cor de cada categoria. A cor aparece em toda impressão
            marcada com ela.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar categorias..."
              aria-label="Filtrar categorias por nome"
              className="w-64 pl-8"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline">
                  <ArrowUpDown />
                  {activeSortLabel}
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={sortOption}
                  onValueChange={(value) => setSortOption(value as SortOption)}
                >
                  {SORT_OPTIONS.map((option) => (
                    <DropdownMenuRadioItem
                      key={option.value}
                      value={option.value}
                      className="data-checked:bg-brand/12 data-checked:text-brand"
                    >
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={hideWithoutPrints}
                onCheckedChange={setHideWithoutPrints}
                className="data-checked:bg-brand/12 data-checked:text-brand"
              >
                <EyeOff />
                Esconder sem impressão
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={onlyInUse}
                onCheckedChange={setOnlyInUse}
                className="data-checked:bg-brand/12 data-checked:text-brand"
              >
                <Filter />
                Só as em uso
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 flex-col">
          <span className="text-xs text-muted-foreground uppercase">
            Categorias
          </span>
          <span className="text-3xl">{categories.length}</span>
        </div>
        <Separator orientation="vertical" />
        <div className="flex items-center gap-2 flex-col">
          <span className="text-xs text-muted-foreground uppercase">
            Em uso
          </span>
          <span className="text-3xl">{categories.length}</span>
        </div>
        <Separator orientation="vertical" />
        <div className="flex items-center gap-2 flex-col">
          <span className="text-xs text-muted-foreground uppercase">
            Sem nenhuma impressão
          </span>
          <span className="text-3xl">{categories.length}</span>
        </div>
        <Separator orientation="vertical" />
        <div className="flex items-center gap-2 flex-col">
          <span className="text-xs text-muted-foreground uppercase">
            Impressões sem categoria
          </span>
          <span className="text-3xl">{categories.length}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted-foreground uppercase">
          Uso por categoria
        </span>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {MOCK_CATEGORY_USAGE.map((item) => (
            <Tooltip key={item.name}>
              <TooltipTrigger
                render={
                  <div
                    className="h-full"
                    style={{
                      backgroundColor: item.color,
                      width: `${(item.count / overallTotal) * 100}%`,
                    }}
                  />
                }
              />
              <TooltipContent>
                {item.name}: {item.count} {item.count === 1 ? "peça" : "peças"}
              </TooltipContent>
            </Tooltip>
          ))}
          <Tooltip>
            <TooltipTrigger
              render={
                <div
                  className="h-full bg-muted-foreground/40"
                  style={{
                    width: `${(MOCK_WITHOUT_CATEGORY / overallTotal) * 100}%`,
                  }}
                />
              }
            />
            <TooltipContent>
              Sem categoria: {MOCK_WITHOUT_CATEGORY} peças
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center justify-between text-[12.5px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: topCategory.color }}
              aria-hidden="true"
            />
            {topCategory.name} e {secondCategory.name} somam{" "}
            {topCategory.count + secondCategory.count} das {categorizedTotal}{" "}
            peças
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-full bg-muted-foreground/40"
              aria-hidden="true"
            />
            {MOCK_WITHOUT_CATEGORY} peças sem categoria
          </span>
        </div>
      </div>

      <Separator />
      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted-foreground uppercase">
          Nova categoria
        </span>
        <form
          className="flex items-center gap-3 rounded-lg border border-brand/40 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newCategoryName.trim();
            if (!name) return;
            handleCreateCategory(name, newCategoryColor);
          }}
        >
          <div className="flex items-center gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Selecionar cor ${color}`}
                aria-pressed={newCategoryColor === color}
                onClick={() => setNewCategoryColor(color)}
                className="size-7 shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand data-[selected=true]:ring-2 data-[selected=true]:ring-brand data-[selected=true]:ring-offset-2 data-[selected=true]:ring-offset-background"
                data-selected={newCategoryColor === color}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <Input
            ref={newCategoryNameRef}
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Nome da categoria"
            aria-label="Nome da nova categoria"
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={isCreating || !newCategoryName.trim()}
            aria-busy={isCreating}
          >
            <Plus />
            {isCreating ? "Adicionando..." : "Adicionar"}
          </Button>
        </form>
        {createError && (
          <p role="alert" className="text-[12.5px] text-destructive">
            {createError}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : loadError ? (
        <p role="alert" className="text-[12.5px] text-destructive">
          {loadError}
        </p>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Tag className="size-6" aria-hidden="true" />
          <p className="text-sm">Nenhuma categoria criada ainda.</p>
        </div>
      ) : visibleCategories.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Search className="size-6" aria-hidden="true" />
          <p className="text-sm">
            Nenhuma categoria encontrada para &ldquo;{search}&rdquo;.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader className="uppercase text-xs">
            <TableRow>
              <TableHead className="text-muted-foreground">Categoria</TableHead>
              <TableHead className="text-muted-foreground">
                Impressões
              </TableHead>
              <TableHead className="w-24 text-right text-muted-foreground">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleCategories.map((category) => (
              <TableRow key={category.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: category.color }}
                      aria-hidden="true"
                    />
                    <span>{category.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span>2</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar ${category.name}`}
                      onClick={() => openEditDialog(category)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:bg-destructive/10"
                      aria-label={`Excluir ${category.name}`}
                      onClick={() => setDeletingCategory(category)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={isFormOpen} onOpenChange={onFormOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar categoria</DialogTitle>
            <DialogDescription>
              Escolha um nome e uma cor para identificar a categoria.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              className="flex flex-col gap-4"
              onSubmit={form.handleSubmit(onSubmitCategory)}
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Bolsas" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cor</FormLabel>
                    <FormControl>
                      <div className="flex flex-wrap items-center gap-2">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            aria-label={`Selecionar cor ${color}`}
                            aria-pressed={field.value === color}
                            onClick={() => field.onChange(color)}
                            className="size-6 rounded-full ring-offset-2 ring-offset-background outline-none focus-visible:ring-2 focus-visible:ring-brand data-[selected=true]:ring-2 data-[selected=true]:ring-foreground"
                            data-selected={field.value === color}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                        <Input
                          type="color"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="size-6 rounded-full border-none p-0"
                          aria-label="Cor personalizada"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {formError && (
                <p role="alert" className="text-[12.5px] text-destructive">
                  {formError}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsFormOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                >
                  {isSubmitting ? "Salvando..." : "Salvar alterações"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletingCategory !== null}
        onOpenChange={onDeleteDialogOpenChange}
      >
        <DialogContent className="ring-destructive/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="size-4.5" aria-hidden="true" />
              Excluir categoria
            </DialogTitle>
            <DialogDescription>
              {deletingCategory && (
                <>
                  Isso remove &ldquo;{deletingCategory.name}&rdquo; das
                  impressões que a usam. Esta ação não pode ser desfeita.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p role="alert" className="text-[12.5px] text-destructive">
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeletingCategory(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
              onClick={confirmDeleteCategory}
              disabled={isDeleting}
              aria-busy={isDeleting}
            >
              {isDeleting ? "Excluindo..." : "Excluir categoria"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
