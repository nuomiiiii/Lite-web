export type ClipboardEnvironment = {
  navigator?: Navigator;
  document?: Document;
};

export type ClipboardWriteResult = {
  confirmed: boolean;
  method: "clipboard" | "legacy";
};

function browserClipboardEnvironment(): ClipboardEnvironment {
  return {
    navigator: typeof navigator === "undefined" ? undefined : navigator,
    document: typeof document === "undefined" ? undefined : document,
  };
}

function copyWithTemporaryTextarea(text: string, documentObject?: Document): boolean {
  if (!documentObject?.body || typeof documentObject.execCommand !== "function") {
    return false;
  }

  const textarea = documentObject.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  documentObject.body.appendChild(textarea);
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange?.(0, text.length);
    return documentObject.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

export async function writeClipboardText(
  text: string,
  environment: ClipboardEnvironment = browserClipboardEnvironment(),
): Promise<ClipboardWriteResult> {
  // This function is called before the save request so Edge still sees the
  // original click gesture. A resolved Clipboard API write is the only path
  // that can positively confirm the system clipboard was updated.
  if (environment.navigator?.clipboard?.writeText) {
    await environment.navigator.clipboard.writeText(text);
    return { confirmed: true, method: "clipboard" };
  }

  if (copyWithTemporaryTextarea(text, environment.document)) {
    return { confirmed: false, method: "legacy" };
  }

  throw new Error("clipboard unavailable");
}
