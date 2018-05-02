var GUI =
(window["webpackJsonpGUI"] = window["webpackJsonpGUI"] || []).push([[2],{

/***/ 227:
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

var DEFAULT_PROJECT_ID = '10015059';

var Player = function (_React$Component) {
    _inherits(Player, _React$Component);

    function Player(props) {
        _classCallCheck(this, Player);

        var _this = _possibleConstructorReturn(this, (Player.__proto__ || Object.getPrototypeOf(Player)).call(this, props));

        _this.updateProject = _this.updateProject.bind(_this);

        _this.state = {
            projectId: window.location.hash.substring(1) || DEFAULT_PROJECT_ID
        };
        return _this;
    }

    _createClass(Player, [{
        key: 'componentDidMount',
        value: function componentDidMount() {
            window.addEventListener('hashchange', this.updateProject);
            if (!window.location.hash.substring(1)) {
                window.location.hash = DEFAULT_PROJECT_ID;
            }
        }
    }, {
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            window.addEventListener('hashchange', this.updateProject);
        }
    }, {
        key: 'updateProject',
        value: function updateProject() {
            this.setState({ projectId: window.location.hash.substring(1) });
        }
    }, {
        key: 'render',
        value: function render() {
            var width = 480;
            var height = 360;
            return react__WEBPACK_IMPORTED_MODULE_0___default.a.createElement(
                'div',
                { style: { display: 'flex' } },
                react__WEBPACK_IMPORTED_MODULE_0___default.a.createElement(
                    _containers_gui_jsx__WEBPACK_IMPORTED_MODULE_6__[/* default */ "a"],
                    _extends({}, this.props, {
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
                ),
                react__WEBPACK_IMPORTED_MODULE_0___default.a.createElement('iframe', {
                    allowFullScreen: true,
                    allowTransparency: true,
                    frameBorder: '0',
                    height: '402',
                    src: 'https://scratch.mit.edu/projects/embed/' + this.state.projectId + '/?autostart=true',
                    width: '485'
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

},[[227,0]]]);
//# sourceMappingURL=compatibilitytesting.js.map