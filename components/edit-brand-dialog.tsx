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
  editBrandSchema,
  type EditBrandInput,
} from "@/lib/schemas/brand";
import { updateBrand } from "@/app/dashboard/brands/actions";
import type { BrandWithAdAccounts } from "@/app/dashboard/brands/actions";

interface EditBrandDialogProps {
  brand: BrandWithAdAccounts;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditBrandDialog({
  brand,
  open,
  onOpenChange,
}: EditBrandDialogProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<EditBrandInput>({
    resolver: zodResolver(editBrandSchema),
    defaultValues: {
      brandId: brand.id,
      name: brand.name,
    },
  });

  useEffect(() => {
    form.reset({ brandId: brand.id, name: brand.name });
  }, [brand, form]);

  function onSubmit(values: EditBrandInput) {
    startTransition(async () => {
      const result = await updateBrand(values);
      if (result.success) {
        toast.success("Marca atualizada com sucesso!");
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
          <DialogTitle>Editar Marca</DialogTitle>
          <DialogDescription>
            Altere o nome da marca.
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
                    <Input placeholder="Nome da marca" {...field} />
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
