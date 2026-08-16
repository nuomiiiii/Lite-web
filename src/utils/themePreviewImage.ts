export type ThemePreviewStatus = "loading" | "loaded" | "error";

type PreviewImageSnapshot = {
  complete: boolean;
  naturalWidth: number;
};

export function resolveThemePreviewStatus(
  src: string | null | undefined,
  image: PreviewImageSnapshot | null,
): ThemePreviewStatus {
  if (!src) return "error";
  if (!image || !image.complete) return "loading";
  return image.naturalWidth > 0 ? "loaded" : "error";
}
