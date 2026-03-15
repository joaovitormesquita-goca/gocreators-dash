"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  editCreatorSchema,
  type EditCreatorInput,
} from "@/lib/schemas/creator";
import {
  updateCreator,
  type CreatorWithBrands,
} from "@/app/dashboard/creators/list/actions";

type Brand = { id: number; name: string };

function buildDefaults(creator: CreatorWithBrands): EditCreatorInput {
  return {
    creatorId: creator.id,
    fullName: creator.full_name,
    email: creator.email ?? "",
    brandAssignments: creator.brands.map((b) => ({
      assignmentId: b.assignmentId,
      brandId: b.id.toString(),
      handles: b.handles.join(", "),
      startDate: b.start_date ? new Date(b.start_date) : new Date(),
    })),
  };
}

export function EditCreatorDialog({
  creator,
  brands,
  open,
  onOpenChange,
}: {
  creator: CreatorWithBrands;
  brands: Brand[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<EditCreatorInput>({
    resolver: zodResolver(editCreatorSchema),
    defaultValues: buildDefaults(creator),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "brandAssignments",
  });

  // Reset form when a different creator is selected
  useEffect(() => {
    form.reset(buildDefaults(creator));
  }, [creator, form]);

  const selectedBrandIds = form
    .watch("brandAssignments")
    .map((ba) => ba.brandId);

  function onSubmit(values: EditCreatorInput) {
    startTransition(async () => {
      const result = await updateCreator(values);
      if (result.success) {
        toast.success("Creator atualizado com sucesso!");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Creator</DialogTitle>
          <DialogDescription>
            Edite os dados e gerencie as marcas vinculadas.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="email@exemplo.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Marcas</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      assignmentId: undefined,
                      brandId: "",
                      handles: "",
                      startDate: new Date(),
                    })
                  }
                  disabled={fields.length >= brands.length}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Adicionar Marca
                </Button>
              </div>

              {form.formState.errors.brandAssignments?.root && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.brandAssignments.root.message}
                </p>
              )}

              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
                  Nenhuma marca vinculada. Clique em &quot;Adicionar
                  Marca&quot;.
                </p>
              )}

              {fields.map((field, index) => {
                const isExisting = field.assignmentId !== undefined;
                const availableBrands = brands.filter(
                  (b) =>
                    b.id.toString() === selectedBrandIds[index] ||
                    !selectedBrandIds.includes(b.id.toString()),
                );

                return (
                  <div
                    key={field.id}
                    className="rounded-md border p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Marca {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <FormField
                        control={form.control}
                        name={`brandAssignments.${index}.brandId`}
                        render={({ field: selectField }) => (
                          <FormItem>
                            <FormLabel>Marca</FormLabel>
                            <Select
                              onValueChange={selectField.onChange}
                              value={selectField.value}
                              disabled={isExisting}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {availableBrands.map((b) => (
                                  <SelectItem
                                    key={b.id}
                                    value={b.id.toString()}
                                  >
                                    {b.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`brandAssignments.${index}.handles`}
                        render={({ field: handlesField }) => (
                          <FormItem>
                            <FormLabel>Handles</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="@handle1, @handle2"
                                {...handlesField}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`brandAssignments.${index}.startDate`}
                        render={({ field: dateField }) => (
                          <FormItem>
                            <FormLabel>Data de Inicio</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !dateField.value &&
                                        "text-muted-foreground",
                                    )}
                                  >
                                    {dateField.value
                                      ? format(dateField.value, "dd/MM/yyyy", {
                                          locale: ptBR,
                                        })
                                      : "Selecione"}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-auto p-0"
                                align="start"
                              >
                                <Calendar
                                  mode="single"
                                  selected={dateField.value}
                                  onSelect={dateField.onChange}
                                  locale={ptBR}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

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
