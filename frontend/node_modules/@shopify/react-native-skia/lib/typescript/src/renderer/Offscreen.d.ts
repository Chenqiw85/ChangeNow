import type { ReactElement } from "react";
import type { SkImage, SkPicture, SkRect, SkSize } from "../skia/types";
export declare const isOnMainThread: () => boolean;
export declare const drawAsPicture: (element: ReactElement, bounds?: SkRect) => Promise<SkPicture>;
export declare const drawAsImage: (element: ReactElement, size: SkSize) => Promise<SkImage | null>;
export declare const drawAsImageFromPicture: (picture: SkPicture, size: SkSize) => SkImage | null;
