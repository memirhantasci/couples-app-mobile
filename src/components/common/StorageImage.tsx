import React from "react";
import { Image, type ImageProps } from "expo-image";
import { useStorageImage, type PrivateBucket } from "@/lib/storageImages";

type StorageImageProps = Omit<ImageProps, "source"> & {
  bucket: PrivateBucket;
  /** Bucket içindeki yol (ör. "12/1700000000_ab12c.jpg"); demo verisinde tam URL olabilir. */
  path: string | null | undefined;
};

/** Özel bucket'taki görseli süreli imzalı URL ile çizer (bkz. src/lib/storageImages.ts). */
export function StorageImage({ bucket, path, ...imageProps }: StorageImageProps) {
  const source = useStorageImage(bucket, path);
  return <Image {...imageProps} source={source} />;
}
