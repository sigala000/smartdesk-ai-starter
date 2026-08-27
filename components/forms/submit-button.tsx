"use client";

import { useFormStatus } from "react-dom";

type SubmitButtonProps = Readonly<{
  children: React.ReactNode;
  className: string;
  pendingLabel: string;
}>;

export function SubmitButton({
  children,
  className,
  pendingLabel,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button className={className} disabled={pending} type="submit">
      {pending ? pendingLabel : children}
    </button>
  );
}
