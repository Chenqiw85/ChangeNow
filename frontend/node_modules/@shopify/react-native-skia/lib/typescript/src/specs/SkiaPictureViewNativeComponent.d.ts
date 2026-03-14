import type { ViewProps } from "react-native";
import type { WithDefault } from "react-native/Libraries/Types/CodegenTypes";
export interface NativeProps extends ViewProps {
    debug?: boolean;
    opaque?: boolean;
    colorSpace?: string;
    androidWarmup?: boolean;
    pointerEvents?: WithDefault<"auto" | "none" | "box-none" | "box-only", "auto">;
}
declare const _default: import("react-native/Libraries/Utilities/codegenNativeComponent").NativeComponentType<NativeProps>;
export default _default;
