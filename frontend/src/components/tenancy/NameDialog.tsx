"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

interface NameDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  submitLabel: string;
  nameLabel?: string;
  nameHint?: string;
  initialName?: string;
  initialDescription?: string;
  onSubmit: (name: string, description: string) => Promise<void>;
}

/** Create/rename dialog for a named entity with an optional description. */
export function NameDialog({
  open,
  onClose,
  title,
  eyebrow = "New",
  submitLabel,
  nameLabel = "Name",
  nameHint,
  initialName = "",
  initialDescription = "",
  onSubmit,
}: NameDialogProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription(initialDescription);
      setError(null);
    }
  }, [open, initialName, initialDescription]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(name.trim(), description.trim());
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} labelledBy="name-dialog-title">
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div>
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-accent">
            {eyebrow}
          </p>
          <h2
            id="name-dialog-title"
            className="mt-1 font-display text-2xl font-medium tracking-tight"
          >
            {title}
          </h2>
        </div>
        <Field
          id="nd-name"
          label={nameLabel}
          hint={nameHint}
          error={error}
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />
        <Field
          id="nd-description"
          label="Description"
          placeholder="Optional"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || name.trim() === ""}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
