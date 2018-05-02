var GUI =
(window["webpackJsonpGUI"] = window["webpackJsonpGUI"] || []).push([[4],{

/***/ 136:
/***/ (function(module, exports, __webpack_require__) {


var content = __webpack_require__(230);

if(typeof content === 'string') content = [[module.i, content, '']];

var transform;
var insertInto;



var options = {"hmr":true}

options.transform = transform
options.insertInto = undefined;

var update = __webpack_require__(7)(content, options);

if(content.locals) module.exports = content.locals;

if(false) {}

/***/ }),

/***/ 137:
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__.p + "static/assets/dd98971c2c185caf86144b6b5234d0fa.svg";

/***/ }),

/***/ 223:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);

// EXTERNAL MODULE: ./node_modules/es6-object-assign/auto.js
var auto = __webpack_require__(350);

// EXTERNAL MODULE: ./node_modules/react/index.js
var react = __webpack_require__(0);
var react_default = /*#__PURE__*/__webpack_require__.n(react);

// EXTERNAL MODULE: ./node_modules/react-dom/index.js
var react_dom = __webpack_require__(26);
var react_dom_default = /*#__PURE__*/__webpack_require__.n(react_dom);

// EXTERNAL MODULE: ./node_modules/react-modal/lib/index.js
var lib = __webpack_require__(29);
var lib_default = /*#__PURE__*/__webpack_require__.n(lib);

// EXTERNAL MODULE: ./src/lib/analytics.js
var analytics = __webpack_require__(11);

// EXTERNAL MODULE: ./src/containers/gui.jsx + 99 modules
var gui = __webpack_require__(49);

// EXTERNAL MODULE: ./node_modules/prop-types/index.js
var prop_types = __webpack_require__(1);
var prop_types_default = /*#__PURE__*/__webpack_require__.n(prop_types);

// EXTERNAL MODULE: ./node_modules/platform/platform.js
var platform = __webpack_require__(41);
var platform_default = /*#__PURE__*/__webpack_require__.n(platform);

// EXTERNAL MODULE: ./src/components/browser-modal/browser-modal.jsx
var browser_modal = __webpack_require__(88);

// EXTERNAL MODULE: ./src/components/box/box.jsx
var box = __webpack_require__(4);

// EXTERNAL MODULE: ./src/components/crash-message/crash-message.css
var crash_message = __webpack_require__(82);
var crash_message_default = /*#__PURE__*/__webpack_require__.n(crash_message);

// EXTERNAL MODULE: ./src/components/crash-message/reload.svg
var reload = __webpack_require__(137);
var reload_default = /*#__PURE__*/__webpack_require__.n(reload);

// CONCATENATED MODULE: ./src/components/crash-message/crash-message.jsx







var crash_message_CrashMessage = function CrashMessage(props) {
    return react_default.a.createElement(
        'div',
        { className: crash_message_default.a.crashWrapper },
        react_default.a.createElement(
            box["a" /* default */],
            { className: crash_message_default.a.body },
            react_default.a.createElement('img', {
                className: crash_message_default.a.reloadIcon,
                src: reload_default.a
            }),
            react_default.a.createElement(
                'h2',
                null,
                'Oops! Something went wrong.'
            ),
            react_default.a.createElement(
                'p',
                null,
                'We are so sorry, but it looks like Scratch has crashed. This bug has been automatically reported to the Scratch Team. Please refresh your page to try again.'
            ),
            react_default.a.createElement(
                'button',
                {
                    className: crash_message_default.a.reloadButton,
                    onClick: props.onReload
                },
                'Reload'
            )
        )
    );
};

crash_message_CrashMessage.propTypes = {
    onReload: prop_types_default.a.func.isRequired
};

/* harmony default export */ var crash_message_crash_message = (crash_message_CrashMessage);
// EXTERNAL MODULE: ./src/lib/log.js
var log = __webpack_require__(24);

// CONCATENATED MODULE: ./src/containers/error-boundary.jsx
var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }









var error_boundary_ErrorBoundary = function (_React$Component) {
    _inherits(ErrorBoundary, _React$Component);

    function ErrorBoundary(props) {
        _classCallCheck(this, ErrorBoundary);

        var _this = _possibleConstructorReturn(this, (ErrorBoundary.__proto__ || Object.getPrototypeOf(ErrorBoundary)).call(this, props));

        _this.state = {
            hasError: false
        };
        return _this;
    }

    _createClass(ErrorBoundary, [{
        key: 'componentDidCatch',
        value: function componentDidCatch(error, info) {
            // Display fallback UI
            this.setState({ hasError: true });
            log["a" /* default */].error('Unhandled Error: ' + error.stack + '\nComponent stack: ' + info.componentStack);
            analytics["a" /* default */].event({
                category: 'error',
                action: 'Fatal Error',
                label: error.message
            });
        }
    }, {
        key: 'handleBack',
        value: function handleBack() {
            window.history.back();
        }
    }, {
        key: 'handleReload',
        value: function handleReload() {
            window.location.replace(window.location.origin + window.location.pathname);
        }
    }, {
        key: 'render',
        value: function render() {
            if (this.state.hasError) {
                // don't use array.includes because that's something that causes IE to crash.
                if (platform_default.a.name === 'IE' || platform_default.a.name === 'Opera' || platform_default.a.name === 'Opera Mini' || platform_default.a.name === 'Silk') {
                    return react_default.a.createElement(browser_modal["a" /* default */], { onBack: this.handleBack });
                }
                return react_default.a.createElement(crash_message_crash_message, { onReload: this.handleReload });
            }
            return this.props.children;
        }
    }]);

    return ErrorBoundary;
}(react_default.a.Component);

error_boundary_ErrorBoundary.propTypes = {
    children: prop_types_default.a.node
};

/* harmony default export */ var error_boundary = (error_boundary_ErrorBoundary);
// CONCATENATED MODULE: ./src/playground/error-boundary-hoc.jsx



/*
 * Higher Order Component to provide error boundary for wrapped component
 * @param {React.Component} WrappedComponent - component to provide state for
 * @returns {React.Component} component with error boundary
 */
var error_boundary_hoc_ErrorBoundaryHOC = function ErrorBoundaryHOC(WrappedComponent) {
    var ErrorBoundaryWrapper = function ErrorBoundaryWrapper(props) {
        return react_default.a.createElement(
            error_boundary,
            null,
            react_default.a.createElement(WrappedComponent, props)
        );
    };
    return ErrorBoundaryWrapper;
};

/* harmony default export */ var error_boundary_hoc = (error_boundary_hoc_ErrorBoundaryHOC);
// EXTERNAL MODULE: ./src/playground/index.css
var playground = __webpack_require__(136);
var playground_default = /*#__PURE__*/__webpack_require__.n(playground);

// CONCATENATED MODULE: ./src/playground/index.jsx
var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };












if ("production" === 'production' && (typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object') {
    // Warn before navigating away
    window.onbeforeunload = function () {
        return true;
    };
}

// Register "base" page view
analytics["a" /* default */].pageview('/');

var App = error_boundary_hoc(gui["a" /* default */]);

var appTarget = document.createElement('div');
appTarget.className = playground_default.a.app;
document.body.appendChild(appTarget);

lib_default.a.setAppElement(appTarget);

react_dom_default.a.render(react_default.a.createElement(App, null), appTarget);

/***/ }),

/***/ 230:
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(8)(false);
// imports


// module
exports.push([module.i, "html,\nbody,\n.index_app_3Qs6X {\n    /* probably unecessary, transitional until layout is refactored */\n    width: 100%; \n    height: 100%;\n    margin: 0;\n}\n\n/* @todo: move globally? Safe / side FX, for blocks particularly? */\n\n* { -webkit-box-sizing: border-box; box-sizing: border-box; }\n", ""]);

// exports
exports.locals = {
	"app": "index_app_3Qs6X"
};

/***/ }),

/***/ 231:
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(8)(false);
// imports


// module
exports.push([module.i, "/* #E5F0FF */ /* #E9F1FC */ /* #D9E3F2 */ /* 90% transparent version of motion-primary */ /* #FFFFFF */ /* 25% transparent version of ui-white */ /* 15% transparent version of black */ /* #575E75 */ /* #4C97FF */ /* #3373CC */ /* 35% transparent version of motion-primary */ /* #FF661A */ /* #E64D00 */ /* #CF63CF */ /* #BD42BD */ /* #FFAB19 */ /* #FF8C1A */ /* #0FBD8C */ /* layout contants from `layout-constants.js` */ body {\n    font-family: \"Helvetica Neue\", Helvetica, Arial, sans-serif;\n} h2 {\n    font-size: 1.5rem;\n    font-weight: bold;\n} p {\n    font-size: 1rem;\n    line-height: 1.5em;\n} .crash-message_crash-wrapper_25B61 {\n    background-color: hsla(215, 100%, 65%, 1);\n    width: 100%;\n    height: 100%;\n    display: -webkit-box;\n    display: -webkit-flex;\n    display: -ms-flexbox;\n    display: flex;\n    -webkit-box-pack: center;\n    -webkit-justify-content: center;\n        -ms-flex-pack: center;\n            justify-content: center;\n    -webkit-box-align: center;\n    -webkit-align-items: center;\n        -ms-flex-align: center;\n            align-items: center;\n} .crash-message_body_1q0lu {\n    width: 35%;\n    color: white;\n    text-align: center;\n} .crash-message_reloadButton_FoS7x {\n    border: 1px solid hsla(215, 100%, 65%, 1);\n    border-radius: 0.25rem;\n    padding: 0.5rem 2rem;\n    background: white;\n    color: hsla(215, 100%, 65%, 1);\n    font-weight: bold;\n    font-size: 0.875rem;\n    cursor: pointer;\n}\n", ""]);

// exports
exports.locals = {
	"crash-wrapper": "crash-message_crash-wrapper_25B61",
	"crashWrapper": "crash-message_crash-wrapper_25B61",
	"body": "crash-message_body_1q0lu",
	"reloadButton": "crash-message_reloadButton_FoS7x"
};

/***/ }),

/***/ 82:
/***/ (function(module, exports, __webpack_require__) {


var content = __webpack_require__(231);

if(typeof content === 'string') content = [[module.i, content, '']];

var transform;
var insertInto;



var options = {"hmr":true}

options.transform = transform
options.insertInto = undefined;

var update = __webpack_require__(7)(content, options);

if(content.locals) module.exports = content.locals;

if(false) {}

/***/ })

},[[223,0]]]);
//# sourceMappingURL=gui.js.map