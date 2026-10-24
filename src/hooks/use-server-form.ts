"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm, type DefaultValues, type FieldValues, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import type { ActionResult } from "@/lib/errors";

interface Options<TSchema extends z.ZodType, TData> {
  schema: TSchema;
  defaultValues: z.input<TSchema>;
  action: (input: unknown) => Promise<ActionResult<TData>>;
  /** Toast shown on success. Omit for flows that navigate away. */
  successMessage?: string;
  onSuccess?: (data: TData) => void;
  /** Keep the values after a successful save (settings pages) instead of resetting. */
  resetOnSuccess?: boolean;
}

/**
 * One consistent form pipeline everywhere: client-side validation with the same Zod schema the
 * server uses → server action (which re-validates; the server is authoritative) → field errors and
 * form-level errors mapped back onto the form.
 */
export function useServerForm<TSchema extends z.ZodType, TData>({
  schema,
  defaultValues,
  action,
  successMessage,
  onSuccess,
  resetOnSuccess,
}: Options<TSchema, TData>) {
  const form = useForm<FieldValues>({
    resolver: zodResolver(schema as never) as Resolver<FieldValues>,
    defaultValues: defaultValues as DefaultValues<FieldValues>,
  });
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const submit = form.handleSubmit(() => {
    setFormError(null);
    // Send the raw input; the server parses (and transforms) it again.
    const raw = form.getValues();
    startTransition(async () => {
      const result = await action(raw);
      if (result.ok) {
        if (successMessage) toast.success(successMessage);
        if (resetOnSuccess) form.reset(defaultValues as DefaultValues<FieldValues>);
        else form.reset(raw);
        onSuccess?.(result.data);
        return;
      }
      const { message, fieldErrors } = result.error;
      let placed = false;
      for (const [path, messages] of Object.entries(fieldErrors ?? {})) {
        if (path === "_form") continue;
        form.setError(path, { type: "server", message: messages[0] });
        placed = true;
      }
      if (!placed || !fieldErrors) setFormError(message);
      else if (result.error.code !== "VALIDATION") setFormError(message);
    });
  });

  return { form, submit, pending, formError, setFormError };
}
