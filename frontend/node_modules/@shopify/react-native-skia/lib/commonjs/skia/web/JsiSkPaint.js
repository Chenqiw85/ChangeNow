"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.JsiSkPaint = void 0;
var _Host = require("./Host");
var _JsiSkColorFilter = require("./JsiSkColorFilter");
var _JsiSkImageFilter = require("./JsiSkImageFilter");
var _JsiSkMaskFilter = require("./JsiSkMaskFilter");
var _JsiSkPathEffect = require("./JsiSkPathEffect");
var _JsiSkShader = require("./JsiSkShader");
// Custom blend mode values (must match TypeScript BlendMode enum)
const kBlendModePlusDarker = 1001;
const kBlendModePlusLighter = 1002;

// SkSL for PlusDarker blend mode
// Formula: rc = max(0, 1 - ((1-dst) + (1-src))) = max(0, src + dst - 1)
const plusDarkerSkSL = `
    vec4 main(vec4 src, vec4 dst) {
        float outAlpha = src.a + dst.a - src.a * dst.a;
        vec3 srcUnpremul = src.a > 0.0 ? src.rgb / src.a : vec3(0.0);
        vec3 dstUnpremul = dst.a > 0.0 ? dst.rgb / dst.a : vec3(0.0);
        vec3 blended = max(vec3(0.0), srcUnpremul + dstUnpremul - vec3(1.0));
        return vec4(blended * outAlpha, outAlpha);
    }
`;

// SkSL for PlusLighter blend mode
// Formula: rc = min(1, dst + src)
const plusLighterSkSL = `
    vec4 main(vec4 src, vec4 dst) {
        float outAlpha = src.a + dst.a - src.a * dst.a;
        vec3 srcUnpremul = src.a > 0.0 ? src.rgb / src.a : vec3(0.0);
        vec3 dstUnpremul = dst.a > 0.0 ? dst.rgb / dst.a : vec3(0.0);
        vec3 blended = min(vec3(1.0), srcUnpremul + dstUnpremul);
        return vec4(blended * outAlpha, outAlpha);
    }
`;

// Cache for custom blenders per CanvasKit instance
// Using WeakMap ensures blenders are cleaned up when CanvasKit instance is garbage collected

const blenderCache = new WeakMap();
const getBlenderCache = ck => {
  let cache = blenderCache.get(ck);
  if (!cache) {
    cache = {
      plusDarker: null,
      plusLighter: null
    };
    blenderCache.set(ck, cache);
  }
  return cache;
};
class JsiSkPaint extends _Host.HostObject {
  constructor(CanvasKit, ref) {
    super(CanvasKit, ref, "Paint");
  }
  copy() {
    return new JsiSkPaint(this.CanvasKit, this.ref.copy());
  }
  assign(paint) {
    this.ref = paint.ref.copy();
  }
  reset() {
    this.ref = new this.CanvasKit.Paint();
  }
  getAlphaf() {
    return this.getColor()[3];
  }
  getColor() {
    return this.ref.getColor();
  }
  getStrokeCap() {
    return this.ref.getStrokeCap().value;
  }
  getStrokeJoin() {
    return this.ref.getStrokeJoin().value;
  }
  getStrokeMiter() {
    return this.ref.getStrokeMiter();
  }
  getStrokeWidth() {
    return this.ref.getStrokeWidth();
  }
  setAlphaf(alpha) {
    this.ref.setAlphaf(alpha);
  }
  setAntiAlias(aa) {
    this.ref.setAntiAlias(aa);
  }
  setDither(dither) {
    this.ref.setDither(dither);
  }
  setBlendMode(blendMode) {
    if (blendMode === kBlendModePlusDarker) {
      // Use custom PlusDarker blender via SkRuntimeEffect
      const cache = getBlenderCache(this.CanvasKit);
      if (!cache.plusDarker) {
        const effect = this.CanvasKit.RuntimeEffect.MakeForBlender(plusDarkerSkSL);
        if (effect) {
          cache.plusDarker = effect.makeBlender([]);
        }
      }
      if (cache.plusDarker) {
        this.ref.setBlender(cache.plusDarker);
      }
    } else if (blendMode === kBlendModePlusLighter) {
      // Use custom PlusLighter blender via SkRuntimeEffect
      const cache = getBlenderCache(this.CanvasKit);
      if (!cache.plusLighter) {
        const effect = this.CanvasKit.RuntimeEffect.MakeForBlender(plusLighterSkSL);
        if (effect) {
          cache.plusLighter = effect.makeBlender([]);
        }
      }
      if (cache.plusLighter) {
        this.ref.setBlender(cache.plusLighter);
      }
    } else {
      this.ref.setBlendMode((0, _Host.getEnum)(this.CanvasKit, "BlendMode", blendMode));
    }
  }
  setColor(color) {
    this.ref.setColor(color);
  }
  setColorFilter(filter) {
    this.ref.setColorFilter(filter ? _JsiSkColorFilter.JsiSkColorFilter.fromValue(filter) : null);
  }
  setImageFilter(filter) {
    this.ref.setImageFilter(filter ? _JsiSkImageFilter.JsiSkImageFilter.fromValue(filter) : null);
  }
  setMaskFilter(filter) {
    this.ref.setMaskFilter(filter ? _JsiSkMaskFilter.JsiSkMaskFilter.fromValue(filter) : null);
  }
  setPathEffect(effect) {
    this.ref.setPathEffect(effect ? _JsiSkPathEffect.JsiSkPathEffect.fromValue(effect) : null);
  }
  setShader(shader) {
    this.ref.setShader(shader ? _JsiSkShader.JsiSkShader.fromValue(shader) : null);
  }
  setStrokeCap(cap) {
    this.ref.setStrokeCap((0, _Host.getEnum)(this.CanvasKit, "StrokeCap", cap));
  }
  setStrokeJoin(join) {
    this.ref.setStrokeJoin((0, _Host.getEnum)(this.CanvasKit, "StrokeJoin", join));
  }
  setStrokeMiter(limit) {
    this.ref.setStrokeMiter(limit);
  }
  setStrokeWidth(width) {
    this.ref.setStrokeWidth(width);
  }
  setStyle(style) {
    this.ref.setStyle({
      value: style
    });
  }
}
exports.JsiSkPaint = JsiSkPaint;
//# sourceMappingURL=JsiSkPaint.js.map