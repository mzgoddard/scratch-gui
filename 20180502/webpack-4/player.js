var GUI =
(window["webpackJsonpGUI"] = window["webpackJsonpGUI"] || []).push([[1],{

/***/ 224:
/***/ (function(module, exports, __webpack_require__) {

exports = module.exports = __webpack_require__(8)(false);
// imports


// module
exports.push([module.i, "body {\n    padding: 0;\n    margin: 0;\n}\n", ""]);

// exports


/***/ }),

/***/ 225:
/***/ (function(module, exports, __webpack_require__) {


var content = __webpack_require__(224);

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

/***/ 226:
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(0);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(26);
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react_dom__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_redux__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6);
/* harmony import */ var _containers_controls_jsx__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(40);
/* harmony import */ var _containers_stage_jsx__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(63);
/* harmony import */ var _components_box_box_jsx__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(4);
/* harmony import */ var _containers_gui_jsx__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(49);
/* harmony import */ var _lib_project_loader_hoc_jsx__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(53);
/* harmony import */ var _player_css__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(225);
/* harmony import */ var _player_css__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(_player_css__WEBPACK_IMPORTED_MODULE_8__);
var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }













var mapStateToProps = function mapStateToProps(state) {
    return { vm: state.vm };
};

var VMStage = Object(react_redux__WEBPACK_IMPORTED_MODULE_2__["connect"])(mapStateToProps)(_containers_stage_jsx__WEBPACK_IMPORTED_MODULE_4__[/* default */ "a"]);
var VMControls = Object(react_redux__WEBPACK_IMPORTED_MODULE_2__["connect"])(mapStateToProps)(_containers_controls_jsx__WEBPACK_IMPORTED_MODULE_3__[/* default */ "a"]);

var Player = function (_React$Component) {
    _inherits(Player, _React$Component);

    function Player(props) {
        _classCallCheck(this, Player);

        var _this = _possibleConstructorReturn(this, (Player.__proto__ || Object.getPrototypeOf(Player)).call(this, props));

        _this.handleResize = _this.handleResize.bind(_this);
        _this.state = _this.getWindowSize();
        return _this;
    }

    _createClass(Player, [{
        key: 'componentDidMount',
        value: function componentDidMount() {
            window.addEventListener('resize', this.handleResize);
        }
    }, {
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            window.removeEventListener('resize', this.handleResize);
        }
    }, {
        key: 'getWindowSize',
        value: function getWindowSize() {
            return {
                width: window.innerWidth,
                height: window.innerHeight
            };
        }
    }, {
        key: 'handleResize',
        value: function handleResize() {
            this.setState(this.getWindowSize());
        }
    }, {
        key: 'render',
        value: function render() {
            var height = this.state.height - 40;
            var width = height + height / 3;
            if (width > this.state.width) {
                width = this.state.width;
                height = width * .75;
            }
            return react__WEBPACK_IMPORTED_MODULE_0___default.a.createElement(
                _containers_gui_jsx__WEBPACK_IMPORTED_MODULE_6__[/* default */ "a"],
                _extends({}, this.props, {
                    style: {
                        margin: '0 auto'
                    },
                    width: width
                }),
                react__WEBPACK_IMPORTED_MODULE_0___default.a.createElement(
                    _components_box_box_jsx__WEBPACK_IMPORTED_MODULE_5__[/* default */ "a"],
                    { height: 40 },
                    react__WEBPACK_IMPORTED_MODULE_0___default.a.createElement(VMControls, {
                        style: {
                            marginRight: 10,
                            height: 40
                        }
                    })
                ),
                react__WEBPACK_IMPORTED_MODULE_0___default.a.createElement(VMStage, {
                    height: height,
                    width: width
                })
            );
        }
    }]);

    return Player;
}(react__WEBPACK_IMPORTED_MODULE_0___default.a.Component);

var App = Object(_lib_project_loader_hoc_jsx__WEBPACK_IMPORTED_MODULE_7__[/* default */ "a"])(Player);

var appTarget = document.createElement('div');
document.body.appendChild(appTarget);

react_dom__WEBPACK_IMPORTED_MODULE_1___default.a.render(react__WEBPACK_IMPORTED_MODULE_0___default.a.createElement(App, null), appTarget);

/***/ })

},[[226,0]]]);
//# sourceMappingURL=player.js.map