"use client";

import { Upload, Camera, Eye, EyeOff, TriangleAlert } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";
import { useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError, changePassword } from "@/lib/api/auth";
import { useAuth } from "@/contexts/auth-context";
import { deleteUser, updateUser } from "@/lib/api/user";
import { Separator } from "@/components/ui/separator";
import { passwordStrength } from "@/lib/password";

const nameSchema = z.object({
  name: z.string().min(1, "Informe seu nome."),
});

type NameValues = z.infer<typeof nameSchema>;

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Informe sua senha atual."),
  newPassword: z.string().min(8, "Use pelo menos 8 caracteres."),
});

type PasswordValues = z.infer<typeof passwordSchema>;

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Informe sua senha."),
});

type DeleteAccountValues = z.infer<typeof deleteAccountSchema>;

export default function PerfilPage() {
  const router = useRouter();
  const { user, logout, refreshSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const nameForm = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: user?.name ?? "" },
  });

  useEffect(() => {
    nameForm.reset({ name: user?.name ?? "" });
  }, [user, nameForm]);

  async function onSubmitName(values: NameValues) {
    setError(null);
    try {
      if (!user) throw new Error("Not authenticated");
      await updateUser(user.id, values.name);
      await refreshSession();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível salvar as alterações.",
      );
    }
  }

  const isSubmitting = nameForm.formState.isSubmitting;

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  const newPassword = useWatch({
    control: passwordForm.control,
    name: "newPassword",
  });
  const strength = useMemo(
    () => passwordStrength(newPassword ?? ""),
    [newPassword],
  );
  const isChangingPassword = passwordForm.formState.isSubmitting;

  async function onSubmitChangePassword(values: PasswordValues) {
    setPasswordError(null);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      passwordForm.reset();
    } catch (err) {
      setPasswordError(
        err instanceof ApiError
          ? err.message
          : "Não foi possível alterar a senha.",
      );
    }
  }

  const deleteAccountForm = useForm<DeleteAccountValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: "" },
  });
  const isDeletingAccount = deleteAccountForm.formState.isSubmitting;

  async function onSubmitDeleteAccount(values: DeleteAccountValues) {
    if (!user) return;
    try {
      await deleteUser(user.id, values.password);
      await logout();
      router.push("/login");
    } catch (err) {
      deleteAccountForm.setError("password", {
        message:
          err instanceof ApiError
            ? err.message
            : "Não foi possível excluir a conta.",
      });
    }
  }

  function onDeleteDialogOpenChange(open: boolean) {
    setIsDeleteDialogOpen(open);
    if (!open) deleteAccountForm.reset();
  }

  return (
    <div className="p-8 flex flex-col gap-8">
      <div>
        <h1 className="text-4xl font-bold">Perfil</h1>
        <p className="text-muted-foreground text-sm">
          Seus dados de acesso. Nada aqui muda seus registros de impressão.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="h-24 w-24">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback className="text-2xl">Y</AvatarFallback>
          </Avatar>
          <Button
            variant="secondary"
            size="icon-sm"
            className="absolute bottom-0 right-0 rounded-full bg-background"
          >
            <Camera />
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="lg">
              <Upload />
              Escolher foto
            </Button>
            <Button variant="link" size="sm" className="px-0 h-auto">
              Remover
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">PNG ou JPG, até 2 MB.</p>
        </div>
      </div>
      <div>
        <Form {...nameForm}>
          <form
            className="flex flex-col gap-4"
            onSubmit={nameForm.handleSubmit(onSubmitName)}
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={nameForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Seu nome" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input value={user?.email ?? ""} disabled readOnly />
                </FormControl>
              </FormItem>
            </div>
            {error && (
              <p role="alert" className="text-[12.5px] text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="justify-center w-fit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        </Form>
      </div>
      <Separator />
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Senha
          </span>
          <span className="text-xs text-muted-foreground">
            alterada há 4 meses
          </span>
        </div>

        <Form {...passwordForm}>
          <form
            className="flex flex-col gap-4"
            onSubmit={passwordForm.handleSubmit(onSubmitChangePassword)}
          >
            <div className="grid grid-cols-2 gap-4 items-start">
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha atual</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showCurrentPassword ? "text" : "password"}
                          autoComplete="current-password"
                          className="pr-9"
                          {...field}
                        />
                      </FormControl>
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((v) => !v)}
                        aria-label={
                          showCurrentPassword
                            ? "Ocultar senha"
                            : "Mostrar senha"
                        }
                        aria-pressed={showCurrentPassword}
                        className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="size-3.75" aria-hidden="true" />
                        ) : (
                          <Eye className="size-3.75" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova senha</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showNewPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Mínimo 8 caracteres"
                          className="pr-9"
                          {...field}
                        />
                      </FormControl>
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((v) => !v)}
                        aria-label={
                          showNewPassword ? "Ocultar senha" : "Mostrar senha"
                        }
                        aria-pressed={showNewPassword}
                        className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground"
                      >
                        {showNewPassword ? (
                          <EyeOff className="size-3.75" aria-hidden="true" />
                        ) : (
                          <Eye className="size-3.75" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div
                        role="meter"
                        aria-label="Força da senha"
                        aria-valuemin={0}
                        aria-valuemax={4}
                        aria-valuenow={strength.score}
                        aria-valuetext={strength.label}
                        className="flex flex-1 gap-1"
                      >
                        {[0, 1, 2, 3].map((i) => (
                          <span
                            key={i}
                            className={`h-0.75 flex-1 rounded-full ${
                              newPassword && i < strength.score
                                ? "bg-brand"
                                : "bg-neutral-700"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[11.5px] text-muted-foreground">
                        força
                      </span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {passwordError && (
              <p role="alert" className="text-[12.5px] text-destructive">
                {passwordError}
              </p>
            )}
            <Button
              type="submit"
              variant="outline"
              className="justify-center w-fit"
              disabled={isChangingPassword}
              aria-busy={isChangingPassword}
            >
              {isChangingPassword ? "Alterando..." : "Alterar senha"}
            </Button>
          </form>
        </Form>
      </div>
      <Separator />
      <div className="flex flex-col gap-3 items-start">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Excluir conta
        </span>
        <p className="text-sm text-muted-foreground">
          Apaga 142 impressões, 14 rolos, 13 calibrações e o diário inteiro. Não
          há como recuperar depois, e a exclusão não cancela nada fora do app.
        </p>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="link"
            className="h-auto px-0 text-destructive"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            Excluir minha conta
          </Button>
        </div>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={onDeleteDialogOpenChange}>
        <DialogContent className="ring-destructive/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <TriangleAlert className="size-4.5" aria-hidden="true" />
              Excluir a sua conta
            </DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. Confirme com a sua senha para
              continuar.
            </DialogDescription>
          </DialogHeader>
          <Form {...deleteAccountForm}>
            <form
              className="flex flex-col gap-3"
              onSubmit={deleteAccountForm.handleSubmit(
                onSubmitDeleteAccount,
              )}
            >
              <FormField
                control={deleteAccountForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        autoFocus
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center justify-between pt-1">
                <Link
                  href="/forgot-password"
                  className="text-[12.5px] text-muted-foreground hover:text-foreground hover:underline"
                >
                  Esqueci a senha
                </Link>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsDeleteDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive/10"
                    disabled={isDeletingAccount}
                    aria-busy={isDeletingAccount}
                  >
                    {isDeletingAccount ? "Excluindo..." : "Excluir conta"}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
