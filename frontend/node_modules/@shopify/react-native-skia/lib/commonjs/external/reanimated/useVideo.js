"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useVideo = void 0;
var _react = require("react");
var _Platform = require("../../Platform");
var _ReanimatedProxy = _interopRequireDefault(require("./ReanimatedProxy"));
var _useVideoLoading = require("./useVideoLoading");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
const copyFrameOnAndroid = currentFrame => {
  "worklet";

  // on android we need to copy the texture before it's invalidated
  if (_Platform.Platform.OS === "android") {
    const tex = currentFrame.value;
    if (tex) {
      currentFrame.value = tex.makeNonTextureImage();
      tex.dispose();
    }
  }
};
const setFrame = (video, currentFrame) => {
  "worklet";

  const img = video.nextImage();
  if (img) {
    if (currentFrame.value) {
      currentFrame.value.dispose();
    }
    currentFrame.value = img;
    copyFrameOnAndroid(currentFrame);
  }
};
const defaultOptions = {
  looping: true,
  paused: false,
  seek: null,
  volume: 0
};
const useOption = value => {
  "worklet";

  const defaultValue = _ReanimatedProxy.default.useSharedValue(_ReanimatedProxy.default.isSharedValue(value) ? value.value : value);
  return _ReanimatedProxy.default.isSharedValue(value) ? value : defaultValue;
};
const disposeVideo = video => {
  "worklet";

  video === null || video === void 0 || video.dispose();
};
const useVideo = (source, userOptions) => {
  var _userOptions$paused, _userOptions$looping, _userOptions$seek, _userOptions$volume;
  const video = (0, _useVideoLoading.useVideoLoading)(source);
  const isPaused = useOption((_userOptions$paused = userOptions === null || userOptions === void 0 ? void 0 : userOptions.paused) !== null && _userOptions$paused !== void 0 ? _userOptions$paused : defaultOptions.paused);
  const looping = useOption((_userOptions$looping = userOptions === null || userOptions === void 0 ? void 0 : userOptions.looping) !== null && _userOptions$looping !== void 0 ? _userOptions$looping : defaultOptions.looping);
  const seek = useOption((_userOptions$seek = userOptions === null || userOptions === void 0 ? void 0 : userOptions.seek) !== null && _userOptions$seek !== void 0 ? _userOptions$seek : defaultOptions.seek);
  const volume = useOption((_userOptions$volume = userOptions === null || userOptions === void 0 ? void 0 : userOptions.volume) !== null && _userOptions$volume !== void 0 ? _userOptions$volume : defaultOptions.volume);
  const currentFrame = _ReanimatedProxy.default.useSharedValue(null);
  const currentTime = _ReanimatedProxy.default.useSharedValue(0);
  const duration = (0, _react.useMemo)(() => {
    var _video$duration;
    return (_video$duration = video === null || video === void 0 ? void 0 : video.duration()) !== null && _video$duration !== void 0 ? _video$duration : 0;
  }, [video]);
  const framerate = (0, _react.useMemo)(() => {
    var _video$framerate;
    return _Platform.Platform.OS === "web" ? -1 : (_video$framerate = video === null || video === void 0 ? void 0 : video.framerate()) !== null && _video$framerate !== void 0 ? _video$framerate : 0;
  }, [video]);
  const size = (0, _react.useMemo)(() => {
    var _video$size;
    return (_video$size = video === null || video === void 0 ? void 0 : video.size()) !== null && _video$size !== void 0 ? _video$size : {
      width: 0,
      height: 0
    };
  }, [video]);
  const rotation = (0, _react.useMemo)(() => {
    var _video$rotation;
    return (_video$rotation = video === null || video === void 0 ? void 0 : video.rotation()) !== null && _video$rotation !== void 0 ? _video$rotation : 0;
  }, [video]);

  // Handle pause/play state changes
  _ReanimatedProxy.default.useAnimatedReaction(() => isPaused.value, paused => {
    if (paused) {
      video === null || video === void 0 || video.pause();
    } else {
      video === null || video === void 0 || video.play();
    }
  });

  // Handle seek
  _ReanimatedProxy.default.useAnimatedReaction(() => seek.value, value => {
    if (value !== null) {
      video === null || video === void 0 || video.seek(value);
      seek.value = null;
    }
  });

  // Handle volume changes
  _ReanimatedProxy.default.useAnimatedReaction(() => volume.value, value => {
    video === null || video === void 0 || video.setVolume(value);
  });

  // Handle looping changes
  _ReanimatedProxy.default.useAnimatedReaction(() => looping.value, value => {
    video === null || video === void 0 || video.setLooping(value);
  });

  // Frame callback - simplified since native handles frame timing
  _ReanimatedProxy.default.useFrameCallback(_frameInfo => {
    "worklet";

    if (!video) {
      return;
    }
    // Update current time from native player
    currentTime.value = video.currentTime();
    // Get the latest frame (native handles timing via CADisplayLink/etc)
    setFrame(video, currentFrame);
  });

  // Apply initial state when video becomes available
  (0, _react.useEffect)(() => {
    if (video) {
      video.setLooping(looping.value);
      video.setVolume(volume.value);
      if (isPaused.value) {
        video.pause();
      } else {
        video.play();
      }
    }
    return () => {
      _ReanimatedProxy.default.runOnUI(disposeVideo)(video);
    };
  }, [video, isPaused, looping, volume]);
  return {
    currentFrame,
    currentTime,
    duration,
    framerate,
    rotation,
    size
  };
};
exports.useVideo = useVideo;
//# sourceMappingURL=useVideo.js.map