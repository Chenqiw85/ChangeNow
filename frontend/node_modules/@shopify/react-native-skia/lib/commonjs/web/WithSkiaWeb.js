"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WithSkiaWeb = void 0;
var _react = _interopRequireWildcard(require("react"));
var _Platform = require("../Platform");
var _LoadSkiaWeb = require("./LoadSkiaWeb");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
const WithSkiaWeb = ({
  getComponent,
  fallback,
  opts,
  componentProps
}) => {
  const Inner = (0, _react.useMemo)(
  // TODO: investigate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  () => /*#__PURE__*/(0, _react.lazy)(async () => {
    if (_Platform.Platform.OS === "web") {
      await (0, _LoadSkiaWeb.LoadSkiaWeb)(opts);
    } else {
      console.warn("<WithSkiaWeb /> is only necessary on web. Consider not using on native.");
    }
    return getComponent();
  }),
  // We we to run this only once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);
  return /*#__PURE__*/_react.default.createElement(_react.Suspense, {
    fallback: fallback !== null && fallback !== void 0 ? fallback : null
  }, /*#__PURE__*/_react.default.createElement(Inner, componentProps));
};
exports.WithSkiaWeb = WithSkiaWeb;
//# sourceMappingURL=WithSkiaWeb.js.map