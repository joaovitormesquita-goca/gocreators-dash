"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
  editAdAccountSchema,
  type EditAdAccountInput,
} from "@/lib/schemas/brand";
import { updateAdAccount } from "@/app/dashboard/brands/actions";
import type { AdAccount } from "@/app/dashboard/brands/actions";

interface EditAdAccountDialogProps {
  adAccount: AdAccount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditAdAccountDialog({
  adAccount,
  open,
  onOpenChange,
}: EditAdAccountDialogProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<EditAdAccountInput>({
    resolver: zodResolver(editAdAccountSchema),
    defaultValues: {
      adAccountId: adAccount.id,
      name: adAccount.name,
      metaAccountId: adAccount.meta_account_id,
    },
  });

  useEffect(() => {
    form.reset({
      adAccountId: adAccount.id,
      name: adAccount.name,
      metaAccountId: adAccount.meta_account_id,
    });
  }, [adAccount, form]);

  function onSubmit(values: EditAdAccountInput) {
    startTransition(async () => {
      const result = await updateAdAccount(values);
      if (result.success) {
        toast.success("Conta de anúncio atualizada com sucesso!");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Conta de Anúncio</DialogTitle>
          <DialogDescription>
            Altere os dados da conta de anúncio.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome da conta" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="metaAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meta Account ID</FormLabel>
                  <FormControl>
                    <Input placeholder="act_123456789" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
