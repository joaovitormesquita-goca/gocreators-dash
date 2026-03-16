"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  createAdAccountSchema,
  type CreateAdAccountInput,
} from "@/lib/schemas/brand";
import { createAdAccount } from "@/app/dashboard/brands/actions";

interface CreateAdAccountDialogProps {
  brandId: number;
}

export function CreateAdAccountDialog({ brandId }: CreateAdAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<CreateAdAccountInput>({
    resolver: zodResolver(createAdAccountSchema),
    defaultValues: {
      brandId,
      name: "",
      metaAccountId: "",
    },
  });

  function onSubmit(values: CreateAdAccountInput) {
    startTransition(async () => {
      const result = await createAdAccount(values);
      if (result.success) {
        toast.success("Conta de anúncio criada com sucesso!");
        setOpen(false);
        form.reset({ brandId, name: "", metaAccountId: "" });
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) form.reset({ brandId, name: "", metaAccountId: "" });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1 h-3 w-3" />
          Adicionar Conta
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Conta de Anúncio</DialogTitle>
          <DialogDescription>
            Adicione uma conta de anúncio Meta vinculada a esta marca.
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
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvando..." : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
