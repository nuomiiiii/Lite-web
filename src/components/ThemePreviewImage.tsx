import React from "react";
import { Box, Flex, Text } from "@radix-ui/themes";
import { Image as ImageIcon } from "lucide-react";

type ThemePreviewImageProps = {
  src?: string | null;
  alt: string;
  loading?: "eager" | "lazy";
  referrerPolicy?: React.ImgHTMLAttributes<HTMLImageElement>["referrerPolicy"];
  containerClassName?: string;
  imageClassName?: string;
  fit?: "cover" | "contain";
  fallbackLabel?: React.ReactNode;
  iconSize?: number;
};

const joinClassName = (...values: Array<string | undefined | false>) =>
  values.filter(Boolean).join(" ");

export default function ThemePreviewImage({
  src,
  alt,
  loading = "lazy",
  referrerPolicy,
  containerClassName,
  imageClassName,
  fit = "cover",
  fallbackLabel,
  iconSize = 40,
}: ThemePreviewImageProps) {
  const [status, setStatus] = React.useState<"loading" | "loaded" | "error">(
    src ? "loading" : "error",
  );

  React.useEffect(() => {
    setStatus(src ? "loading" : "error");
  }, [src]);

  return (
    <Box
      className={joinClassName("km-theme-preview", containerClassName)}
      data-image-fit={fit}
      data-image-status={status}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading={loading}
          referrerPolicy={referrerPolicy}
          className={joinClassName("km-theme-preview-image", imageClassName)}
          data-loaded={status === "loaded" ? "true" : "false"}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      ) : null}
      <Box className="km-theme-preview-skeleton" aria-hidden="true" />
      <Flex
        align="center"
        justify="center"
        direction="column"
        gap="2"
        className="km-theme-preview-fallback"
        data-visible={status === "error" ? "true" : "false"}
      >
        <ImageIcon size={iconSize} className="text-gray-400" />
        {fallbackLabel ? (
          <Text size="1" color="gray" align="center">
            {fallbackLabel}
          </Text>
        ) : null}
      </Flex>
    </Box>
  );
}
