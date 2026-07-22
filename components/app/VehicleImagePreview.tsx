"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { loadVehicleImage } from "@/lib/storage/vehicle-images";

export function VehicleImagePreview({ imageId, name, alt, className = "" }: { imageId?: string; name?: string; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState<{ imageId: string; url: string } | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!imageId) return;
    loadVehicleImage(imageId).then((blob) => {
      if (!active || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setLoaded({ imageId, url: objectUrl });
    }).catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageId]);

  const url = loaded && loaded.imageId === imageId ? loaded.url : null;
  if (!url) return null;
  return <figure className={`stored-vehicle-image ${className}`}><Image unoptimized width={960} height={540} src={url} alt={alt} /><figcaption>{name}</figcaption></figure>;
}
