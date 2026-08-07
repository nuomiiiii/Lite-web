export type ClipboardEnvironment = {
  navigator?: Navigator;
  document?: Document;
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
) {
  // Keep the copy inside the original click gesture. Edge can block the
  // asynchronous Clipboard API before the request fallback gets a chance.
  if (copyWithTemporaryTextarea(text, environment.document)) {
    return;
  }

  if (environment.navigator?.clipboard?.writeText) {
    await environment.navigator.clipboard.writeText(text);
    return;
  }

  throw new Error("clipboard unavailable");
}
