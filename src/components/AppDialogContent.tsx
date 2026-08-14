import React from "react";
import { Dialog } from "@radix-ui/themes";

type DialogTitleProps = React.ComponentProps<typeof Dialog.Title>;
type DialogDescriptionProps = React.ComponentProps<typeof Dialog.Description>;

export type AppDialogContentProps = Omit<
  React.ComponentProps<typeof Dialog.Content>,
  "children" | "title"
> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  visuallyHiddenDescription?: React.ReactNode;
  disableDescription?: boolean;
  titleProps?: DialogTitleProps;
  descriptionProps?: DialogDescriptionProps;
  children: React.ReactNode;
};

const joinClassName = (...values: Array<string | undefined>) =>
  values.filter(Boolean).join(" ");

export default function AppDialogContent({
  title,
  description,
  visuallyHiddenDescription,
  disableDescription = false,
  titleProps,
  descriptionProps,
  children,
  ...contentProps
}: AppDialogContentProps) {
  const {
    "aria-describedby": ariaDescribedBy,
    ...dialogContentProps
  } = contentProps;
  const descriptionContent = disableDescription
    ? null
    : visuallyHiddenDescription ?? description;
  const descriptionClassName = visuallyHiddenDescription
    ? joinClassName("sr-only", descriptionProps?.className)
    : descriptionProps?.className;
  const dialogAccessibilityProps =
    disableDescription || !descriptionContent
      ? { "aria-describedby": undefined }
      : ariaDescribedBy !== undefined
        ? { "aria-describedby": ariaDescribedBy }
        : {};

  return (
    <Dialog.Content
      {...dialogContentProps}
      {...dialogAccessibilityProps}
    >
      <Dialog.Title {...titleProps}>{title}</Dialog.Title>
      {descriptionContent ? (
        <Dialog.Description
          {...descriptionProps}
          className={descriptionClassName}
        >
          {descriptionContent}
        </Dialog.Description>
      ) : null}
      {children}
    </Dialog.Content>
  );
}
