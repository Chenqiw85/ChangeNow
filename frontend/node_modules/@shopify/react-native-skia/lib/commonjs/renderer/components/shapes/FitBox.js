"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.fitbox = exports.FitBox = void 0;
var _react = _interopRequireWildcard(require("react"));
var _nodes = require("../../../dom/nodes");
var _Group = require("../Group");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function (e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (const t in e) "default" !== t && {}.hasOwnProperty.call(e, t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, t)) && (i.get || i.set) ? o(f, t, i) : f[t] = e[t]); return f; })(e, t); }
const fitbox = (fit, src, dst, rotation = 0) => {
  "worklet";

  const rects = (0, _nodes.fitRects)(fit, rotation === 90 || rotation === 270 ? {
    x: 0,
    y: 0,
    width: src.height,
    height: src.width
  } : src, dst);
  const result = (0, _nodes.rect2rect)(rects.src, rects.dst);
  if (rotation === 90) {
    return [...result, {
      translate: [src.height, 0]
    }, {
      rotate: Math.PI / 2
    }];
  }
  if (rotation === 180) {
    return [...result, {
      translate: [src.width, src.height]
    }, {
      rotate: Math.PI
    }];
  }
  if (rotation === 270) {
    return [...result, {
      translate: [0, src.width]
    }, {
      rotate: -Math.PI / 2
    }];
  }
  return result;
};
exports.fitbox = fitbox;
const FitBox = ({
  fit = "contain",
  src,
  dst,
  children
}) => {
  const transform = (0, _react.useMemo)(() => fitbox(fit, src, dst), [dst, fit, src]);
  return /*#__PURE__*/_react.default.createElement(_Group.Group, {
    transform: transform
  }, children);
};
exports.FitBox = FitBox;
//# sourceMappingURL=FitBox.js.map