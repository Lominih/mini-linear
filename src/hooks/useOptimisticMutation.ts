"use client";

import { useState, useCallback, useRef } from "react";
import { useToast } from "@/components/ui/Toast";

interface UseOptimisticMutationOptions<TData, TVariables> {
  /** Apply optimistic update; return a rollback function (or nothing). */
  onMutate: (variables: TVariables) => (() => void) | void;
  /** The actual async mutation to execute. */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Called after a successful mutation (after the toast). */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Called after a failed mutation (after rollback and toast). */
  onError?: (error: Error, variables: TVariables) => void;
  /** Toast message shown on success. Omit to suppress the toast. */
  successMessage?: string;
  /** Toast message on error – string or function that derives one. */
  errorMessage?: string | ((error: Error) => string);
}

interface UseOptimisticMutationReturn<TData, TVariables> {
  mutate: (variables: TVariables) => Promise<TData | undefined>;
  isPending: boolean;
}

/**
 * Reusable hook for optimistic mutations with automatic rollback on error.
 *
 * Usage example:
 * ```ts
 * const { mutate, isPending } = useOptimisticMutation({
 *   onMutate: (vars) => {
 *     const previous = queryClient.getQueryData(key);
 *     queryClient.setQueryData(key, (old) => /* optimistic patch *​/);
 *     return () => queryClient.setQueryData(key, previous); // rollback
 *   },
 *   mutationFn: (vars) => trpc.issue.update.mutate(vars),
 *   successMessage: "Issue updated",
 *   errorMessage: "Failed to update issue",
 * });
 * ```
 */
export function useOptimisticMutation<TData, TVariables = void>({
  onMutate,
  mutationFn,
  onSuccess,
  onError,
  successMessage,
  errorMessage,
}: UseOptimisticMutationOptions<TData, TVariables>): UseOptimisticMutationReturn<TData, TVariables> {
  const [isPending, setIsPending] = useState(false);
  const { addToast } = useToast();
  const rollbackRef = useRef<(() => void) | null>(null);

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData | undefined> => {
      if (isPending) return undefined;

      setIsPending(true);

      // Apply optimistic update
      const rollback = onMutate(variables);
      rollbackRef.current = typeof rollback === "function" ? rollback : null;

      try {
        const data = await mutationFn(variables);

        if (successMessage) {
          addToast("success", successMessage);
        }
        onSuccess?.(data, variables);

        return data;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        // Rollback optimistic update
        rollbackRef.current?.();
        rollbackRef.current = null;

        const msg =
          typeof errorMessage === "function"
            ? errorMessage(err)
            : (errorMessage ?? "Something went wrong");
        addToast("error", msg);
        onError?.(err, variables);

        return undefined;
      } finally {
        setIsPending(false);
      }
    },
    [
      isPending,
      onMutate,
      mutationFn,
      onSuccess,
      onError,
      successMessage,
      errorMessage,
      addToast,
    ],
  );

  return { mutate, isPending };
}
