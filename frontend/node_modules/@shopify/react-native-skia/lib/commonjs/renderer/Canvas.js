"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useCanvasSize = exports.useCanvasRef = exports.isFabric = exports.Canvas = void 0;
var _react = _interopRequireWildcard(require("react"));
var _ReanimatedProxy = _interopRequireDefault(require("../external/reanimated/ReanimatedProxy"));
var _SkiaViewNativeId = require("../views/SkiaViewNativeId");
var _SkiaPictureViewNativeComponent = _interopRequireDefault(require("../specs/SkiaPictureViewNativeComponent"));
var _Reconciler = require("../sksg/Reconciler");
var _skia = require("../skia");
var _Platform = require("../Platform");
var _external = require("../external");
var _global;
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const useCanvasRef = () => (0, _react.useRef)(null);
exports.useCanvasRef = useCanvasRef;
const useReanimatedFrame = !_external.HAS_REANIMATED_3 ? () => {} : _ReanimatedProxy.default.useFrameCallback;
const measure = !_external.HAS_REANIMATED_3 ? null : _ReanimatedProxy.default.measure;
const useCanvasRefPriv = !_external.HAS_REANIMATED_3 ? _react.useRef : _ReanimatedProxy.default.useAnimatedRef;
const useCanvasSize = userRef => {
  const ourRef = useCanvasRef();
  const ref = userRef !== null && userRef !== void 0 ? userRef : ourRef;
  const [size, setSize] = (0, _react.useState)({
    width: 0,
    height: 0
  });
  (0, _react.useLayoutEffect)(() => {
    if (ref.current) {
      ref.current.measure((_x, _y, width, height) => {
        setSize({
          width,
          height
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return {
    ref,
    size
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
exports.useCanvasSize = useCanvasSize;
const isFabric = exports.isFabric = Boolean((_global = global) === null || _global === void 0 ? void 0 : _global.nativeFabricUIManager);
const Canvas = ({
  debug,
  opaque,
  children,
  onSize,
  colorSpace = "p3",
  androidWarmup = false,
  ref,
  onLayout,
  ...viewProps
}) => {
  if (onLayout && isFabric) {
    console.error("<Canvas onLayout={onLayout} /> is not supported on the new architecture, to fix the issue, see: https://shopify.github.io/react-native-skia/docs/canvas/overview/#getting-the-canvas-size");
  }
  const viewRef = useCanvasRefPriv(null);
  // Native ID
  const nativeId = (0, _react.useMemo)(() => {
    return _SkiaViewNativeId.SkiaViewNativeId.current++;
  }, []);

  // Root
  const root = (0, _react.useMemo)(() => new _Reconciler.SkiaSGRoot(_skia.Skia, nativeId), [nativeId]);
  useReanimatedFrame(() => {
    "worklet";

    if (onSize && measure) {
      var _viewRef$current;
      const result =
      // eslint-disable-next-line no-nested-ternary
      _Platform.Platform.OS === "web" ?
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      (_viewRef$current = viewRef.current) !== null && _viewRef$current !== void 0 && _viewRef$current.canvasRef ?
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      measure(viewRef.current.canvasRef) : {
        width: 0,
        height: 0
      } :
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      measure(viewRef);
      if (result) {
        const {
          width,
          height
        } = result;
        if (onSize.value.width !== width || onSize.value.height !== height) {
          onSize.value = {
            width,
            height
          };
        }
      }
    }
  }, !!onSize);

  // Render effects
  (0, _react.useLayoutEffect)(() => {
    root.render(children);
  }, [children, root, nativeId]);
  (0, _react.useEffect)(() => {
    return () => {
      root.unmount();
    };
  }, [root]);

  // Component methods
  (0, _react.useImperativeHandle)(ref, () => ({
    makeImageSnapshot: rect => {
      return SkiaViewApi.makeImageSnapshot(nativeId, rect);
    },
    makeImageSnapshotAsync: rect => {
      return SkiaViewApi.makeImageSnapshotAsync(nativeId, rect);
    },
    redraw: () => {
      SkiaViewApi.requestRedraw(nativeId);
    },
    getNativeId: () => {
      return nativeId;
    },
    measure: callback => {
      var _viewRef$current2;
      (_viewRef$current2 = viewRef.current) === null || _viewRef$current2 === void 0 || _viewRef$current2.measure(callback);
    },
    measureInWindow: callback => {
      var _viewRef$current3;
      (_viewRef$current3 = viewRef.current) === null || _viewRef$current3 === void 0 || _viewRef$current3.measureInWindow(callback);
    }
  }));
  const onLayoutWeb = (0, _react.useCallback)(e => {
    if (onLayout) {
      onLayout(e);
    }
    if (_Platform.Platform.OS === "web" && onSize) {
      const {
        width,
        height
      } = e.nativeEvent.layout;
      onSize.value = {
        width,
        height
      };
    }
  }, [onLayout, onSize]);
  return /*#__PURE__*/_react.default.createElement(_SkiaPictureViewNativeComponent.default, _extends({
    ref: viewRef,
    collapsable: false,
    nativeID: `${nativeId}`,
    debug: debug,
    opaque: opaque,
    colorSpace: colorSpace,
    androidWarmup: androidWarmup,
    onLayout: _Platform.Platform.OS === "web" && (onSize || onLayout) ? onLayoutWeb : onLayout
  }, viewProps));
};
exports.Canvas = Canvas;
//# sourceMappingURL=Canvas.js.map