var GUI =
(window["webpackJsonpGUI"] = window["webpackJsonpGUI"] || []).push([[1],{

/***/ 1388:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(55);
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react_dom__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_redux__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6);
/* harmony import */ var _containers_controls_jsx__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(256);
/* harmony import */ var _containers_blocks_jsx__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(399);
/* harmony import */ var _containers_gui_jsx__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(136);
/* harmony import */ var _lib_hash_parser_hoc_jsx__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(163);
/* harmony import */ var _lib_app_state_hoc_jsx__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(129);
/* harmony import */ var _blocks_only_css__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(854);
/* harmony import */ var _blocks_only_css__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(_blocks_only_css__WEBPACK_IMPORTED_MODULE_8__);










var mapStateToProps = function mapStateToProps(state) {
  return {
    vm: state.scratchGui.vm
  };
};

var VMBlocks = Object(react_redux__WEBPACK_IMPORTED_MODULE_2__[/* connect */ "b"])(mapStateToProps)(_containers_blocks_jsx__WEBPACK_IMPORTED_MODULE_4__["default"]);
var VMControls = Object(react_redux__WEBPACK_IMPORTED_MODULE_2__[/* connect */ "b"])(mapStateToProps)(_containers_controls_jsx__WEBPACK_IMPORTED_MODULE_3__[/* default */ "a"]);

var BlocksOnly = function BlocksOnly(props) {
  return react__WEBPACK_IMPORTED_MODULE_0___default.a.createElement(_containers_gui_jsx__WEBPACK_IMPORTED_MODULE_5__[/* default */ "a"], props, react__WEBPACK_IMPORTED_MODULE_0___default.a.createElement(VMBlocks, {
    grow: 1,
    options: {
      media: "static/blocks-media/"
    }
  }), react__WEBPACK_IMPORTED_MODULE_0___default.a.createElement(VMControls, {
    className: _blocks_only_css__WEBPACK_IMPORTED_MODULE_8___default.a.controls
  }));
};

var App = Object(_lib_app_state_hoc_jsx__WEBPACK_IMPORTED_MODULE_7__[/* default */ "a"])(Object(_lib_hash_parser_hoc_jsx__WEBPACK_IMPORTED_MODULE_6__[/* default */ "a"])(BlocksOnly));
var appTarget = document.createElement('div');
document.body.appendChild(appTarget);
react_dom__WEBPACK_IMPORTED_MODULE_1___default.a.render(react__WEBPACK_IMPORTED_MODULE_0___default.a.createElement(App, null), appTarget);

/***/ }),

/***/ 854:
/***/ (function(module, exports, __webpack_require__) {

// extracted by mini-css-extract-plugin
module.exports = {"controls":"blocks-only_controls_2GEvs"};

/***/ })

},[[1388,0]]]);
//# sourceMappingURL=blocksonly.js.map