"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Group = void 0;
var _react = _interopRequireWildcard(require("react"));
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const Group = ({
  layer,
  ...props
}) => {
  if (/*#__PURE__*/(0, _react.isValidElement)(layer) && typeof layer === "object") {
    return /*#__PURE__*/_react.default.createElement("skLayer", null, layer, /*#__PURE__*/_react.default.createElement("skGroup", props));
  }
  return /*#__PURE__*/_react.default.createElement("skGroup", _extends({
    layer: layer
  }, props));
};
exports.Group = Group;
//# sourceMappingURL=Group.js.map