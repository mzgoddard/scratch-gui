import bindAll from 'lodash.bindall';
import debounce from 'lodash.debounce';
import defaultsDeep from 'lodash.defaultsdeep';
import makeToolboxXML from '../lib/make-toolbox-xml';
import PropTypes from 'prop-types';
import React from 'react';
import VMScratchBlocks from '../lib/blocks';
import VM from 'scratch-vm';

import log from '../lib/log.js';
import Prompt from './prompt.jsx';
import BlocksComponent from '../components/blocks/blocks.jsx';
import ExtensionLibrary from './extension-library.jsx';
import extensionData from '../lib/libraries/extensions/index.jsx';
import CustomProcedures from './custom-procedures.jsx';
import errorBoundaryHOC from '../lib/error-boundary-hoc.jsx';
import {STAGE_DISPLAY_SIZES} from '../lib/layout-constants';
import DropAreaHOC from '../lib/drop-area-hoc.jsx';
import DragConstants from '../lib/drag-constants';

import {connect} from 'react-redux';
import {updateToolbox} from '../reducers/toolbox';
import {activateColorPicker} from '../reducers/color-picker';
import {closeExtensionLibrary, openSoundRecorder, openConnectionModal} from '../reducers/modals';
import {activateCustomProcedures, deactivateCustomProcedures} from '../reducers/custom-procedures';
import {setConnectionModalExtensionId} from '../reducers/connection-modal';

import {
    activateTab,
    SOUNDS_TAB_INDEX
} from '../reducers/editor-tab';

const addFunctionListener = (object, property, callback) => {
    const oldFn = object[property];
    object[property] = function () {
        const result = oldFn.apply(this, arguments);
        callback.apply(this, result);
        return result;
    };
};

const DroppableBlocks = DropAreaHOC([
    DragConstants.BACKPACK_CODE
])(BlocksComponent);

const hijackTokenize = ScratchBlocks => {
    const splitRE = /%(\{[^}]+\})/g;
    const splitInterpolationRE = /%(\d+|\{[^}]*\})/g;
    const numberRE = /\d+/;
    const subInterpolate = function (tokens, rawKey, parseInterpolationTokens) {
        if (/[a-zA-Z][a-zA-Z0-9_]*/.test(rawKey)) {  // Strict matching
            // Found a valid string key. Attempt case insensitive match.
            var keyUpper = rawKey.toUpperCase();

            // BKY_ is the prefix used to namespace the strings used in Blockly
            // core files and the predefined blocks in ../blocks/. These strings
            // are defined in ../msgs/ files.
            var bklyKey = keyUpper.startsWith('BKY_') ?
            keyUpper.substring(4) : null;
            if (bklyKey && bklyKey in ScratchBlocks.Msg) {
                var rawValue = ScratchBlocks.Msg[bklyKey];
                if (typeof rawValue === 'string') {
                    // Attempt to dereference substrings, too, appending to the end.
                    // Array.prototype.push.apply(tokens,
                    //     ScratchBlocks.utils.tokenizeInterpolation(rawValue));
                    ScratchBlocks.utils.tokenizeInterpolation(rawValue)
                        .forEach(subItem => {
                            if (typeof subItem === 'string' && tokens.length && typeof tokens[tokens.length - 1] === 'string') {
                                tokens[tokens.length - 1] += subItem;
                            } else {
                                tokens.push(subItem);
                            }
                        });
                } else if (parseInterpolationTokens) {
                    // When parsing interpolation tokens, numbers are special
                    // placeholders (%1, %2, etc). Make sure all other values are
                    // strings.
                    tokens.push(String(rawValue));
                } else {
                    tokens.push(rawValue);
                }
            } else {
                // No entry found in the string table. Pass reference as string.
                tokens.push('%{' + rawKey + '}');
            }
        } else {
            tokens.push('%{' + rawKey + '}');
        }
    };
    ScratchBlocks.utils.tokenizeInterpolation_ = function(message,
        parseInterpolationTokens) {
        return message
            .split(parseInterpolationTokens ? splitInterpolationRE : splitRE)
            .reduce((tokens, item, index, split) => {
                if (!item) {
                    return tokens;
                }
                if (index % 2 === 0) {
                    if (tokens.length && typeof tokens[tokens.length - 1] === 'string') {
                        tokens[tokens.length - 1] += item;
                    } else {
                        tokens.push(item);
                    }
                } else {
                    if ('0' <= item[0] && item[0] <= '9') {
                        tokens.push(parseInt(item, 10));
                    } else {
                        // console.log(item, message, split);
                        subInterpolate(tokens, item.substring(1, item.length - 1), parseInterpolationTokens);
                    }
                }
                return tokens;
            }, []);
    };
    return;

    ScratchBlocks.utils.tokenizeInterpolation_ = function(message,
        parseInterpolationTokens) {
      var tokens = [];
      // var chars = message.split('');
      // chars.push('');  // End marker.
      // Parse the message with a finite state machine.
      // 0 - Base case.
      // 1 - % found.
      // 2 - Digit found.
      // 3 - Message ref found.
      var state = 0;
      var buffer = [];
      var subStart = 0;
      var number = null;
      for (var i = 0; i < message.length; i++) {
        var c = message[i];
        if (state == 0) {
          if (c == '%') {
            // var text = buffer.join('');
            var text = message.substring(subStart, i);
            if (text) {
              tokens.push(text);
            }
            // buffer.length = 0;
            subStart = i + 1;
            state = 1;  // Start escape.
          } else {
            // buffer.push(c);  // Regular char.
            for (i++; i < message.length; i++) {
                if (message[i] == '%') {
                    i--;
                    break;
                }
            }
          }
        } else if (state == 1) {
          if (c == '%') {
            // buffer.push(c);  // Escaped %: %%
            state = 0;
          } else if (parseInterpolationTokens && '0' <= c && c <= '9') {
            state = 2;
            // number = c;
            // var text = buffer.join('');
            var text = message.substring(subStart, i);
            if (text) {
              tokens.push(text);
            }
            // buffer.length = 0;
            subStart = i;
          } else if (c == '{') {
            subStart = i + 1;
            state = 3;
          } else {
            // buffer.push('%', c);  // Not recognized. Return as literal.
            subStart -= 1;
            state = 0;
          }
        } else if (state == 2) {
          if ('0' <= c && c <= '9') {
            // number += c;  // Multi-digit number.
            for (i++; i < message.length; i++) {
                c = message[i];
                if ('0' <= c && c <= '9') {
                    i--;
                    break;
                }
            }
          } else {
            // tokens.push(parseInt(number, 10));
            tokens.push(parseInt(message.substring(subStart, i), 10));
            subStart = i;
            i--;  // Parse this char again.
            state = 0;
          }
        } else if (state == 3) {  // String table reference
          if (c == '') {
            // Premature end before closing '}'
            // buffer.splice(0, 0, '%{'); // Re-insert leading delimiter
            subStart -= 2;
            i--;  // Parse this char again.
            state = 0; // and parse as string literal.
          } else if (c != '}') {
            // buffer.push(c);
            for (i++; i < message.length; i++) {
                if (message[i] == '}' || message[i] == '') {
                    i--;
                    break;
                }
            }
          } else  {
            // var rawKey = buffer.join('');
            var rawKey = message.substring(subStart, i);
            if (/[a-zA-Z][a-zA-Z0-9_]*/.test(rawKey)) {  // Strict matching
              // Found a valid string key. Attempt case insensitive match.
              var keyUpper = rawKey.toUpperCase();

              // BKY_ is the prefix used to namespace the strings used in Blockly
              // core files and the predefined blocks in ../blocks/. These strings
              // are defined in ../msgs/ files.
              var bklyKey = keyUpper.startsWith('BKY_') ?
                  keyUpper.substring(4) : null;
              if (bklyKey && bklyKey in ScratchBlocks.Msg) {
                var rawValue = ScratchBlocks.Msg[bklyKey];
                if (typeof rawValue === 'string') {
                  // Attempt to dereference substrings, too, appending to the end.
                  Array.prototype.push.apply(tokens,
                      ScratchBlocks.utils.tokenizeInterpolation(rawValue));
                } else if (parseInterpolationTokens) {
                  // When parsing interpolation tokens, numbers are special
                  // placeholders (%1, %2, etc). Make sure all other values are
                  // strings.
                  tokens.push(String(rawValue));
                } else {
                  tokens.push(rawValue);
                }
              } else {
                // No entry found in the string table. Pass reference as string.
                tokens.push('%{' + rawKey + '}');
              }
              // buffer.length = 0;  // Clear the array
              subStart = i + 1;
              state = 0;
            } else {
              tokens.push('%{' + rawKey + '}');
              // buffer.length = 0;
              subStart = i + 1;
              state = 0; // and parse as string literal.
            }
          }
        }
      }
      // var text = buffer.join('');
      var text = message.substring(subStart);
      if (text) {
        if (state === 2) {
            tokens.push(parseInt(text, 10));
        } else {
            tokens.push(text);
        }
      }

      // Merge adjacent text tokens into a single string.
      var mergedTokens = [];
      buffer.length = 0;
      for (var i = 0; i < tokens.length; ++i) {
        if (typeof tokens[i] == 'string') {
          buffer.push(tokens[i]);
        } else {
          text = buffer.join('');
          if (text) {
            mergedTokens.push(text);
          }
          buffer.length = 0;
          mergedTokens.push(tokens[i]);
        }
      }
      text = buffer.join('');
      if (text) {
        mergedTokens.push(text);
      }
      buffer.length = 0;

      // console.log(message, mergedTokens);
      return mergedTokens;
    };
};

let early = true;
let p;

const hijackCreateSvgElement = (ScratchBlocks, root) => {
    // return;
    // p = function () {
    //     return p.defer;
    // };
    // p.defer = {
    //     then: function (cb) {
    //         if (p._defer) {
    //             p._defer.push(cb);
    //         } else {
    //             cb();
    //         }
    //     }
    // };
    p = (function() {
        let s;
        return function () {
            if (!s) {
                s = {
                    _: [],
                    then: function (cb) {
                        s._.push(cb);
                    }
                };
                Promise.resolve().then(() => {
                    for (let i = 0; i < s._.length; i++) {
                        s._[i]();
                    }
                    s = null;
                });
            }
            return s;
        };
    }());

    // p().then(() => {early = false;});
    const hasAncestor = (el, ancestor) => {
        while (el.parentElement) {
            if (el.parentElement === ancestor) {
                return true;
            }
            el = el.parentElement;
        }
        return false;
    };

    if (root) {
        let listenerMaps = {};
        let listeners;

        const setAttributeNS = Element.prototype.setAttributeNS;
        const elSetAttributeNS = function (...args) {
            p().then(() => setAttributeNS.call(this, ...args));
        };

        const onMouseDown_ = ScratchBlocks.Field.prototype.onMouseDown_;
        ScratchBlocks.Field.prototype.onMouseDown_ = function(e) {
            console.log('Field.onMouseDown_', this.sourceBlock_, this.sourceBlock_.workspace);
            return onMouseDown_.call(this, e);
        };

        const addEventListener = Element.prototype.addEventListener;
        const elAddEventListener = function (...args) {
            if (args[2]) {
                addEventListener.call(this, ...args);
                return;
            }

            if (!listenerMaps[args[0]]) {
                const event = args[0];
                listenerMaps[event] = new WeakMap();
                root.addEventListener(event, function (eventObject) {
                    let target = eventObject.target;
                    while (target && target !== root.parentNode) {
                        const handlers = listenerMaps[event].get(target);
                        if (handlers) {
                            for (let i = 0; i < handlers.length; i++) {
                                if (handlers[i].call(target, eventObject) || eventObject.cancelBubble) {
                                    return true;
                                }
                            }
                        }
                        target = target.parentNode;
                    }
                });
            }

            if (!listeners) {
                p().then(() => {
                    if (!listeners) {
                        addEventListener.call(this, ...args);
                        return;
                    }
                    for (let i = 0; i < listeners.length; i++) {
                        const [element, event, ...options] = listeners[i];
                        if (hasAncestor(element, root)) {
                            let subset = listenerMaps[event].get(element);
                            if (!subset) {
                                listenerMaps[event].set(element, subset = []);
                            }
                            subset.push(options[0]);
                        } else {
                            addEventListener.call(...listeners[i]);
                        }
                    }
                    listeners = null;
                });
                listeners = [];
            }
            if (listeners) {
                listeners.push([this, ...args]);
            } else {
                addEventListener.call(this, ...args);
            }
        };

        const createSvgElement = ScratchBlocks.utils.createSvgElement;
        ScratchBlocks.utils.createSvgElement = function (name, attrs, parent) {
            const el = document.createElementNS(ScratchBlocks.SVG_NS, name);

            // let setter;
            // const attributes = {};
            // const setAttribute = el.setAttribute;
            // el.setAttribute = function (key, value) {
            //     attributes[key] = value;
            //     if (key === 'class') {
            //         setAttribute.call(this, key, value);
            //     } else {
            //         if (!setter) {
            //             setter = new Set();
            //             p().then(() => {
            //                 for (const key of setter) {
            //                     setAttribute.call(this, key, attributes[key]);
            //                 }
            //                 setter = null;
            //             });
            //         }
            //         setter.add(key);
            //     }
            // };
            // const getAttribute = el.getAttribute;
            // el.getAttribute = function (key) {
            //     return attributes[key] || getAttribute.call(this, key);
            // };

            // el.setAttributeNS = elSetAttributeNS;
            el.addEventListener = elAddEventListener;

            for (let key in attrs) {
                el.setAttribute(key, attrs[key]);
            }

            if (parent) {
                parent.appendChild(el);
            }

            return el;
        };
    }
    return;

    const runtimeStyle = Boolean(document.body.runtimeStyle);
    const nodeTemplates = {};
    const attrTemplates = {};
    const templates = {};
    ScratchBlocks.utils.createSvgElement = function(name, attrs, parent /*, opt_workspace */) {
        var id = name;
        for (var key in attrs) {
            id += ':' + key;
        }
        if (!templates[id]) {
            const [template, keys] = templates[id] = [document.createElementNS(ScratchBlocks.SVG_NS, name), []];
            for (var key in attrs) {
                keys.push(key);
                const attr = document.createAttribute(key);
                attr.value = attrs[key];
                template.attributes.setNamedItem(attr);
            }
            // console.log(id, template.keys, attrs);
        }
        const [t, keys] = templates[id];
        var e = t.cloneNode();
        for (var i = 0; i < keys.length; i++) {
            e.attributes[i].value = attrs[keys[i]];
            // e.attributes.item(i).value = attrs[keys[i]];
            // e.setAttribute(keys[i], attrs[keys[i]]);
        }
        // for (let key in attrs) {
        //     e.setAttribute(key, attrs[key]);
        // }
        // for (var key in attrs) {
        //     const item = e.attributes.getNamedItem(key);
        //     if (!item) {
        //         debugger;
        //     }
        //     item.value = attrs[key];
        // }
        // for (var key in attrs) {
        //     if (!attrTemplates[key]) {
        //         attrTemplates[key] = document.createAttribute(key);
        //     }
        //     var node = attrTemplates[key].cloneNode();
        //     node.value = attrs[key];
        //     e.attributes.setNamedItem(node);
        //   // e.setAttribute(key, attrs[key]);
        // }

      //   if (!nodeTemplates[name]) {
      //       nodeTemplates[name] = document.createElementNS(ScratchBlocks.SVG_NS, name);
      //   }
      // // var e = /** @type {!SVGElement} */
      // //     (document.createElementNS(ScratchBlocks.SVG_NS, name));
      // var e = nodeTemplates[name].cloneNode();
      // for (var key in attrs) {
      //     if (!attrTemplates[key]) {
      //         attrTemplates[key] = document.createAttribute(key);
      //     }
      //     var node = attrTemplates[key].cloneNode();
      //     node.value = attrs[key];
      //     e.attributes.setNamedItem(node);
      //   // e.setAttribute(key, attrs[key]);
      // }
      // IE defines a unique attribute "runtimeStyle", it is NOT applied to
      // elements created with createElementNS. However, Closure checks for IE
      // and assumes the presence of the attribute and crashes.
      if (runtimeStyle) {  // Indicates presence of IE-only attr.
        e.runtimeStyle = e.currentStyle = e.style;
      }
      if (parent) {
        parent.appendChild(e);
      }
      return e;
    };
};

hijackCreateSvgElement.post = function (ScratchBlocks) {
    if (!p || !p._defer) return;
    for (let i = 0; i < p._defer.length; i++) {
        p._defer[i]();
    }
    p._defer = null;
};

const hijackTextToDOM = function (ScratchBlocks) {
    // const root = document.createElementNS('text/xml', 'xml');
    const root = new DOMParser().parseFromString('<xml></xml>', 'text/xml').firstChild;
    const range = document.createRange();
    range.selectNodeContents(root);
    ScratchBlocks.Xml.textToDom = function(text) {
        // console.log(range.createContextualFragment(text).firstChild);
        root.innerHTML = text;
        return root.firstChild;
        // console.log(root.firstChild);
        // return range.createContextualFragment(text).firstChild;
        var oParser = new DOMParser();
        var dom = oParser.parseFromString(text, 'text/xml');
        // The DOM should have one and only one top-level node, an XML tag.
        if (!dom || !dom.firstChild ||
            dom.firstChild.nodeName.toLowerCase() != 'xml' ||
            dom.firstChild !== dom.lastChild) {
                // Whatever we got back from the parser is not XML.
                goog.asserts.fail('Blockly.Xml.textToDom did not obtain a valid XML tree.');
        }
        // console.log(dom.firstChild);
        return dom.firstChild;
    };
};

const hijackCompareStrings = function (ScratchBlocks) {
    const collator = new Intl.Collator([], {
        sensitivity: 'base',
        numeric: true
    });
    ScratchBlocks.scratchBlocksUtils.compareStrings = collator.compare.bind(collator);
};

const hijackBindEvent = function (ScratchBlocks) {
    ScratchBlocks.bindEvent_ = function(node, name, thisObject, func) {
      var wrapFunc = function(e) {
        if (thisObject) {
          func.call(thisObject, e);
        } else {
          func(e);
        }
      };

      node.addEventListener(name, wrapFunc, false);
      var bindData = [[node, name, wrapFunc]];

      // Add equivalent touch event.
      if (name in ScratchBlocks.Touch.TOUCH_MAP) {
        var touchWrapFunc = function(e) {
          // Punt on multitouch events.
          if (e.changedTouches.length == 1) {
            // Map the touch event's properties to the event.
            var touchPoint = e.changedTouches[0];
            e.clientX = touchPoint.clientX;
            e.clientY = touchPoint.clientY;
          }
          wrapFunc(e);

          // Stop the browser from scrolling/zooming the page.
          e.preventDefault();
        };
        for (var i = 0, type; type = ScratchBlocks.Touch.TOUCH_MAP[name][i]; i++) {
          node.addEventListener(type, touchWrapFunc, false);
          bindData.push([node, type, touchWrapFunc]);
        }
      }
      return bindData;
    };

    /**
     * Unbind one or more events event from a function call.
     * @param {!Array.<!Array>} bindData Opaque data from bindEvent_.
     *     This list is emptied during the course of calling this function.
     * @return {!Function} The function call.
     * @private
     */
    ScratchBlocks.unbindEvent_ = function(bindData) {
      while (bindData.length) {
        var bindDatum = bindData.pop();
        var node = bindDatum[0];
        var name = bindDatum[1];
        var func = bindDatum[2];
        node.removeEventListener(name, func, false);
      }
      return func;
    };
};

let textRoot;
let textIdCache = {};
const precacheTextWidths = ({ScratchBlocks, xml, root}) => {
    // const svgTag = ScratchBlocks.utils.createSvgElement;
    const svgTag = tagName => document.createElementNS(ScratchBlocks.SVG_NS, tagName);

    if (!textRoot) {
        const _getCachedWidth = ScratchBlocks.Field.getCachedWidth;
        ScratchBlocks.Field.getCachedWidth = function (text) {
            // _getCachedWidth.apply(this, arguments);
            // console.log(text.textContent, text.className.baseVal, ScratchBlocks.Field.cacheWidths_[text.textContent + '\n' + text.className.baseVal]);

            if (!ScratchBlocks.Field._caching && !ScratchBlocks.Field.cacheWidths_[text.textContent + '\n' + text.className.baseVal]) {
                const textElement = text;
                console.log('uncached', textElement.textContent, textElement.textContent.split('').map(c => c.charCodeAt(0)), textElement.className.baseVal, ScratchBlocks.Field.cacheWidths_[text.textContent + '\n' + text.className.baseVal]);
            }
            return _getCachedWidth.apply(this, arguments);
        };

        // const getHeight = ScratchBlocks.Toolbox.CategoryMenu.prototype.getHeight;
        // ScratchBlocks.Toolbox.CategoryMenu.prototype.getHeight = function () {
        //     console.log('CategoryMenu.getHeight', new Error('stacktrace').stack);
        //     return getHeight.call(this);
        // };

        textRoot = svgTag('svg');
        document.body.appendChild(textRoot);
        // console.log(ScratchBlocks.ScratchMsgs.locales.en);
        // console.log(ScratchBlocks.Blocks);
        // console.log(ScratchBlocks.Msg);

        hijackTokenize(ScratchBlocks); // Inconclusive
        hijackCreateSvgElement(ScratchBlocks, root); // Inconclusive
        hijackTextToDOM(ScratchBlocks); // <10%
        hijackCompareStrings(ScratchBlocks); // Scales logarithmically with number of variables
        // hijackBindEvent(ScratchBlocks);

        ScratchBlocks.Field.startCache();

        // const DataCategory = ScratchBlocks.DataCategory;
        // ScratchBlocks.DataCategory = function (...args) {
        //     const result = DataCategory.call(this, ...args);
        //     console.log(result);
        //     return result;
        // };
        // Object.assign(ScratchBlocks.DataCategory, DataCategory);

        // let splice;
        // const clearOldBlocks_ = ScratchBlocks.Flyout.prototype.clearOldBlocks_;
        // ScratchBlocks.Flyout.prototype.clearOldBlocks_ = function () {
        //     splice = this.recycleBlocks_.splice;
        //     this.recycleBlocks_.splice = function () {
        //         // console.log('use recycled block');
        //         return splice.apply(this, arguments);
        //     };
        //
        //     const result = clearOldBlocks_.call(this, arguments);
        //     console.log('recycled', this.recycleBlocks_.length);
        //     return result;
        // };
        //
        // const domToBlock = ScratchBlocks.Xml.domToBlock;
        // ScratchBlocks.Xml.domToBlock = function () {
        //     console.log('domToBlock');
        //     return domToBlock.apply(this, arguments);
        // };

        // ScratchBlocks.Tooltip.bindMouseEvents = function () {};

        ScratchBlocks.svgResize = function (workspace) {
            var mainWorkspace = workspace;
            while (mainWorkspace.options.parentWorkspace) {
              mainWorkspace = mainWorkspace.options.parentWorkspace;
            }
            var svg = mainWorkspace.getParentSvg();
            var div = svg.parentNode;
            if (!div) {
              // Workspace deleted, or something.
              return;
            }
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            var width = div.offsetWidth;
            var height = div.offsetHeight;
            if (svg.cachedWidth_ != width) {
              // svg.setAttribute('width', width + 'px');
              svg.cachedWidth_ = width;
            }
            if (svg.cachedHeight_ != height) {
              // svg.setAttribute('height', height + 'px');
              svg.cachedHeight_ = height;
            }
            mainWorkspace.resize();
        };

        let is3dSupportedElement;

        (function() {
          if (ScratchBlocks.utils.is3dSupported.cached_ !== undefined) {
            return ScratchBlocks.utils.is3dSupported.cached_;
          }
          // CC-BY-SA Lorenzo Polidori
          // stackoverflow.com/questions/5661671/detecting-transform-translate3d-support
          // if (!goog.global.getComputedStyle) {
          //   return false;
          // }

          var el = is3dSupportedElement = document.createElement('p');
          var has3d = 'none';
          var transforms = {
            'webkitTransform': '-webkit-transform',
            'OTransform': '-o-transform',
            'msTransform': '-ms-transform',
            'MozTransform': '-moz-transform',
            'transform': 'transform'
          };

          // Add it to the body to get the computed style.
          document.body.insertBefore(el, null);

          for (var t in transforms) {
            if (el.style[t] !== undefined) {
              el.style[t] = 'translate3d(1px,1px,1px)';
            }
          }
        }());

        ScratchBlocks.utils.is3dSupported = function() {
            if (ScratchBlocks.utils.is3dSupported.cached_ !== undefined) {
              return ScratchBlocks.utils.is3dSupported.cached_;
            }
            var el = is3dSupportedElement;
            var has3d = 'none';
            var transforms = {
              'webkitTransform': '-webkit-transform',
              'OTransform': '-o-transform',
              'msTransform': '-ms-transform',
              'MozTransform': '-moz-transform',
              'transform': 'transform'
            };
            for (var t in transforms) {
                if (el.style[t] !== undefined) {
                // var computedStyle = goog.global.getComputedStyle(el);
                var computedStyle = el.computedStyleMap();
                if (!computedStyle) {
                  // getComputedStyle in Firefox returns null when blockly is loaded
                  // inside an iframe with display: none.  Returning false and not
                  // caching is3dSupported means we try again later.  This is most likely
                  // when users are interacting with blocks which should mean blockly is
                  // visible again.
                  // See https://bugzilla.mozilla.org/show_bug.cgi?id=548397
                  document.body.removeChild(el);
                  return false;
                }
                has3d = computedStyle.get(transforms[t]);
              }
            }
            document.body.removeChild(el);
            ScratchBlocks.utils.is3dSupported.cached_ = has3d !== 'none';
            return ScratchBlocks.utils.is3dSupported.cached_;
        };
    } else {
        // early = true;
        // p().then(() => {early = false;});
    }

    p && (p._defer = []);

    const blocklyText = text => {
        const tag = svgTag('text');
        tag.setAttribute('class', 'blocklyText');
        tag.textContent = text;
        return tag;
    }

    blocklyText.class = 'blocklyText';

    const blocklyDropdownText = text => {
        const tag = svgTag('text');
        tag.setAttribute('class', 'blocklyText blocklyDropdownText');
        tag.textContent = text;
        return tag;
    }

    blocklyDropdownText.class = 'blocklyText blocklyDropdownText';

    const blocklyFlyoutLabelText = text => {
        const tag = svgTag('text');
        tag.setAttribute('class', 'blocklyFlyoutLabelText');
        tag.textContent = text;
        return tag;
    }

    blocklyText.class = 'blocklyFlyoutLabelText';

    // const dom = new DOMParser().parseFromString(xml, 'application/xml');
    const dom = ScratchBlocks.Xml.textToDom(xml);

    const textGroup = svgTag('g');

    const isCached = (subcache, type, text) => {
        const key = `${subcache}:${text}\n${type.class}`;
        if (!textIdCache[key]) {
            textIdCache[key] = true;
            return false;
        }
        return true;
    };

    const add = (type, text) => {
        if (isCached('add', type, text)) return;
        textGroup.appendChild(type(text));
    };

    const justCache = (type, text) => {
        if (!text) {
            return;
        }
        add(type, text);
    };

    const cacheOne = (type, text) => {
        if (isCached('one', type, text)) return;

        if (!text) {
            return;
        }
        add(type, text.replace(/ /g, '\u00a0'));
    };

    const cacheSplit = (type, text) => {
        if (isCached('split', type, text)) return;

        if (!text) {
            return;
        }
        for (const _sub of text.split(/\%\d+/)) {
            const sub = _sub.trim().replace(/ /g, '\u00a0');
            add(type, sub);
        }
    };

    const cacheProccode = (type, text) => {
        if (isCached('proccode', type, text)) return;

        if (!text) {
            return;
        }
        for (const _sub of text.split(/\%[bns]/)) {
            const sub = _sub.trim().replace(/ /g, '\u00a0');
            add(type, sub);
        }
    };

    const cacheLocalized = (type, key) => {
        let _key = key.toUpperCase();
        if (_key.startsWith('BKY_')) {
            _key = _key.substring(4);
        }
        justCache(type, ScratchBlocks.Msg[_key]);
    };

    const cacheBlock = (type, id) => {
        // if (!id) {
        //     if (textIdCache['cacheBlock:' + type]) return;
        //     textIdCache['cacheBlock:' + type] = true;
        // }
        if (textIdCache['cacheBlock:' + type]) return;

        let hasDropdown = false;
        try {
        ScratchBlocks.Blocks[type].init.call({
            id,
            jsonInit(def) {
                // console.log(type, id, def);
                if (def.message0) {
                    cacheSplit(blocklyText, def.message0);
                }
                if (def.message1) {
                    let i = 2;
                    let key = 'message1';
                    do {
                        cacheSplit(blocklyText, def[key]);
                    } while (def[key = 'message' + i++])
                }
                if (def.args0) {
                    for (const arg of def.args0) {
                        if (arg.variable) {
                            cacheOne(blocklyDropdownText, arg.variable);
                        }
                        if (arg.type === 'field_dropdown') {
                            hasDropdown = true;
                            let {options} = arg;
                            if (typeof options === 'function') {
                                options = options();
                                // console.log(type, 'options', options);
                            }
                            for (const option of options) {
                                cacheOne(blocklyDropdownText, option[0]);
                            }
                        }
                    }
                }
            }
        });
        } catch (e) {
            console.log('cacheBlock', id, e);
        }
        if (!hasDropdown) {
            textIdCache['cacheBlock:' + type] = true;
        }
    };

    cacheOne(blocklyText, ' ');
    cacheOne(blocklyDropdownText, ' ');
    justCache(blocklyText, ScratchBlocks.Msg.NEW_VARIABLE);
    justCache(blocklyText, ScratchBlocks.Msg.NEW_LIST);
    justCache(blocklyText, ScratchBlocks.Msg.NEW_PROCEDURE);
    cacheOne(blocklyText, ScratchBlocks.Msg.CONTROL_STOP);
    cacheOne(blocklyDropdownText, ScratchBlocks.Msg.CONTROL_STOP_ALL);
    cacheOne(blocklyDropdownText, ScratchBlocks.Msg.CONTROL_STOP_THIS);
    cacheOne(blocklyDropdownText, ScratchBlocks.Msg.CONTROL_STOP_OTHER);

    cacheBlock('data_setvariableto');
    cacheBlock('data_changevariableby');
    cacheBlock('data_showvariable');
    cacheBlock('data_hidevariable');

    cacheLocalized(blocklyText, 'DEFAULT_LIST_ITEM');
    justCache(blocklyText, 1);

    cacheBlock('data_addtolist');
    cacheBlock('data_deleteoflist');
    cacheBlock('data_deletealloflist');
    cacheBlock('data_insertatlist');
    cacheBlock('data_replaceitemoflist');
    cacheBlock('data_itemoflist');
    cacheBlock('data_itemnumoflist');
    cacheBlock('data_lengthoflist');
    cacheBlock('data_listcontainsitem');
    cacheBlock('data_showlist');
    cacheBlock('data_hidelist');

    const sweep = function (el) {
        // console.log(el);
        if (ScratchBlocks.Blocks[el.getAttribute('type')]) {
            try {
                cacheBlock(el.getAttribute('type'), el.getAttribute('id'));
            } catch (e) {
                console.log('error', el, e);
            }
        }
        if (el.tagName.toLowerCase() === 'mutation') {
            cacheProccode(blocklyText, el.getAttribute('proccode'));
        } else if (el.tagName.toLowerCase() === 'category') {
            let name = el.getAttribute('name');
            if (name[0] === '%') {
                cacheLocalized(blocklyFlyoutLabelText, name.substring(2, name.length - 1));
            } else {
                justCache(blocklyFlyoutLabelText, name);
            }
        } else if (el.tagName.toLowerCase() === 'label') {
            justCache(blocklyFlyoutLabelText, el.getAttribute('text'));
        } else if (el.tagName.toLowerCase() === 'field') {
            cacheOne(blocklyText, el.textContent);
        } else if (el.tagName.toLowerCase() === 'variable') {
            cacheOne(blocklyText, el.textContent);
            cacheOne(blocklyDropdownText, el.textContent);
        }
        for (const child of el.children) {
            sweep(child);
        }
    };

    let mainWorkspace = ScratchBlocks.mainWorkspace;
    if (!mainWorkspace) {
        ScratchBlocks.mainWorkspace = {
            options: {
                pathToMedia: ''
            }
        };
    }

    // Array.from(dom.children).forEach(sweep);

    const nodes = Array.from(dom.children);
    while (nodes.length) {
        const el = nodes.shift();
        const type = el.getAttribute('type');
        if (ScratchBlocks.Blocks[type]) {
            try {
                cacheBlock(type, el.getAttribute('id'));
            } catch (e) {
                console.log('error', el, e);
            }
        }
        const tagName = el.tagName.toLowerCase();
        if (tagName === 'mutation') {
            cacheProccode(blocklyText, el.getAttribute('proccode'));
        } else if (tagName === 'category') {
            let name = el.getAttribute('name');
            if (name[0] === '%') {
                cacheLocalized(blocklyFlyoutLabelText, name.substring(2, name.length - 1));
            } else {
                justCache(blocklyFlyoutLabelText, name);
            }
        } else if (tagName === 'label') {
            justCache(blocklyFlyoutLabelText, el.getAttribute('text'));
        } else if (tagName === 'field') {
            cacheOne(blocklyText, el.textContent);
        } else if (tagName === 'variable') {
            cacheOne(blocklyText, el.textContent);
            cacheOne(blocklyDropdownText, el.textContent);
        }
        for (let i = 0; i < el.children.length; i++) {
            nodes.push(el.children[i]);
        }
    }

    if (!mainWorkspace) {
        ScratchBlocks.mainWorkspace = mainWorkspace;
    }

    textRoot.appendChild(textGroup);

    ScratchBlocks.Field._caching = true;
    for (const element of textGroup.children) {
        ScratchBlocks.Field.getCachedWidth(element);
    }
    ScratchBlocks.Field._caching = false;

    textRoot.removeChild(textGroup);

    // console.log(textGroup);
    // console.log(dom);
    // console.log(xml);

    ScratchBlocks.utils.is3dSupported();
};

precacheTextWidths.post = function ({ScratchBlocks}) {
    hijackCreateSvgElement.post(ScratchBlocks);
};

class Blocks extends React.Component {
    constructor (props) {
        super(props);
        this.ScratchBlocks = VMScratchBlocks(props.vm);
        bindAll(this, [
            'attachVM',
            'detachVM',
            'getToolboxXML',
            'handleCategorySelected',
            'handleConnectionModalStart',
            'handleDrop',
            'handleStatusButtonUpdate',
            'handleOpenSoundRecorder',
            'handlePromptStart',
            'handlePromptCallback',
            'handlePromptClose',
            'handleCustomProceduresClose',
            'onScriptGlowOn',
            'onScriptGlowOff',
            'onBlockGlowOn',
            'onBlockGlowOff',
            'handleExtensionAdded',
            'handleBlocksInfoUpdate',
            'onTargetsUpdate',
            'onVisualReport',
            'onWorkspaceUpdate',
            'onWorkspaceMetricsChange',
            'setBlocks',
            'setLocale'
        ]);
        this.ScratchBlocks.prompt = this.handlePromptStart;
        this.ScratchBlocks.statusButtonCallback = this.handleConnectionModalStart;
        this.ScratchBlocks.recordSoundCallback = this.handleOpenSoundRecorder;

        this.state = {
            workspaceMetrics: {},
            prompt: null
        };
        this.onTargetsUpdate = debounce(this.onTargetsUpdate, 100);
        this.toolboxUpdateQueue = [];
    }
    componentDidMount () {
        this.ScratchBlocks.FieldColourSlider.activateEyedropper_ = this.props.onActivateColorPicker;
        this.ScratchBlocks.Procedures.externalProcedureDefCallback = this.props.onActivateCustomProcedures;
        this.ScratchBlocks.ScratchMsgs.setLocale(this.props.locale);

        precacheTextWidths({ScratchBlocks: this.ScratchBlocks, xml: this.props.toolboxXML, root: this.blocks});

        const workspaceConfig = defaultsDeep({},
            Blocks.defaultOptions,
            this.props.options,
            {rtl: this.props.isRtl, toolbox: this.props.toolboxXML}
        );

        // const fragment = document.createDocumentFragment();
        // const appendChild = this.blocks.appendChild;
        // this.blocks.appendChild = function (child) {
        //     fragment.appendChild(child);
        // };
        this.workspace = this.ScratchBlocks.inject(this.blocks, workspaceConfig);
        // appendChild.call(this.blocks, fragment);

        precacheTextWidths.post({ScratchBlocks: this.ScratchBlocks});

        // Store the xml of the toolbox that is actually rendered.
        // This is used in componentDidUpdate instead of prevProps, because
        // the xml can change while e.g. on the costumes tab.
        this._renderedToolboxXML = this.props.toolboxXML;

        // we actually never want the workspace to enable "refresh toolbox" - this basically re-renders the
        // entire toolbox every time we reset the workspace.  We call updateToolbox as a part of
        // componentDidUpdate so the toolbox will still correctly be updated
        this.setToolboxRefreshEnabled = this.workspace.setToolboxRefreshEnabled.bind(this.workspace);
        this.workspace.setToolboxRefreshEnabled = () => {
            this.setToolboxRefreshEnabled(false);
        };

        // @todo change this when blockly supports UI events
        addFunctionListener(this.workspace, 'translate', this.onWorkspaceMetricsChange);
        addFunctionListener(this.workspace, 'zoom', this.onWorkspaceMetricsChange);

        this.attachVM();
        // Only update blocks/vm locale when visible to avoid sizing issues
        // If locale changes while not visible it will get handled in didUpdate
        if (this.props.isVisible) {
            this.setLocale();
        }
    }
    shouldComponentUpdate (nextProps, nextState) {
        return (
            this.state.prompt !== nextState.prompt ||
            this.props.isVisible !== nextProps.isVisible ||
            this._renderedToolboxXML !== nextProps.toolboxXML ||
            this.props.extensionLibraryVisible !== nextProps.extensionLibraryVisible ||
            this.props.customProceduresVisible !== nextProps.customProceduresVisible ||
            this.props.locale !== nextProps.locale ||
            this.props.anyModalVisible !== nextProps.anyModalVisible ||
            this.props.stageSize !== nextProps.stageSize
        );
    }
    componentDidUpdate (prevProps) {
        // If any modals are open, call hideChaff to close z-indexed field editors
        if (this.props.anyModalVisible && !prevProps.anyModalVisible) {
            this.ScratchBlocks.hideChaff();
        }

        // Only rerender the toolbox when the blocks are visible and the xml is
        // different from the previously rendered toolbox xml.
        // Do not check against prevProps.toolboxXML because that may not have been rendered.
        if (this.props.isVisible && this.props.toolboxXML !== this._renderedToolboxXML) {
            this.requestToolboxUpdate();
        }

        if (this.props.isVisible === prevProps.isVisible) {
            if (this.props.stageSize !== prevProps.stageSize) {
                // force workspace to redraw for the new stage size
                window.dispatchEvent(new Event('resize'));
            }
            return;
        }
        // @todo hack to resize blockly manually in case resize happened while hidden
        // @todo hack to reload the workspace due to gui bug #413
        if (this.props.isVisible) { // Scripts tab
            this.workspace.setVisible(true);
            if (prevProps.locale !== this.props.locale || this.props.locale !== this.props.vm.getLocale()) {
                // call setLocale if the locale has changed, or changed while the blocks were hidden.
                // vm.getLocale() will be out of sync if locale was changed while not visible
                this.setLocale();
            } else {
                this.props.vm.refreshWorkspace();
                this.requestToolboxUpdate();
            }

            window.dispatchEvent(new Event('resize'));
        } else {
            this.workspace.setVisible(false);
        }
    }
    componentWillUnmount () {
        this.detachVM();
        this.workspace.dispose();
        clearTimeout(this.toolboxUpdateTimeout);
    }
    requestToolboxUpdate () {
        clearTimeout(this.toolboxUpdateTimeout);
        this.toolboxUpdateTimeout = setTimeout(() => {
            this.updateToolbox();
        }, 0);
    }
    setLocale () {
        this.ScratchBlocks.ScratchMsgs.setLocale(this.props.locale);
        this.props.vm.setLocale(this.props.locale, this.props.messages)
            .then(() => {
                this.workspace.getFlyout().setRecyclingEnabled(false);
                this.props.vm.refreshWorkspace();
                this.requestToolboxUpdate();
                this.withToolboxUpdates(() => {
                    this.workspace.getFlyout().setRecyclingEnabled(true);
                });
            });
    }

    updateToolbox () {
        this.toolboxUpdateTimeout = false;

        const categoryId = this.workspace.toolbox_.getSelectedCategoryId();
        const offset = this.workspace.toolbox_.getCategoryScrollOffset();

        precacheTextWidths({ScratchBlocks: this.ScratchBlocks, xml: this.props.toolboxXML});
        this.workspace.updateToolbox(this.props.toolboxXML);
        this._renderedToolboxXML = this.props.toolboxXML;

        precacheTextWidths.post({ScratchBlocks: this.ScratchBlocks});

        // In order to catch any changes that mutate the toolbox during "normal runtime"
        // (variable changes/etc), re-enable toolbox refresh.
        // Using the setter function will rerender the entire toolbox which we just rendered.
        this.workspace.toolboxRefreshEnabled_ = true;

        const currentCategoryPos = this.workspace.toolbox_.getCategoryPositionById(categoryId);
        const currentCategoryLen = this.workspace.toolbox_.getCategoryLengthById(categoryId);
        if (offset < currentCategoryLen) {
            this.workspace.toolbox_.setFlyoutScrollPos(currentCategoryPos + offset);
        } else {
            this.workspace.toolbox_.setFlyoutScrollPos(currentCategoryPos);
        }

        const queue = this.toolboxUpdateQueue;
        this.toolboxUpdateQueue = [];
        queue.forEach(fn => fn());
    }

    withToolboxUpdates (fn) {
        // if there is a queued toolbox update, we need to wait
        if (this.toolboxUpdateTimeout) {
            this.toolboxUpdateQueue.push(fn);
        } else {
            fn();
        }
    }

    attachVM () {
        this.workspace.addChangeListener(this.props.vm.blockListener);
        this.flyoutWorkspace = this.workspace
            .getFlyout()
            .getWorkspace();
        this.flyoutWorkspace.addChangeListener(this.props.vm.flyoutBlockListener);
        this.flyoutWorkspace.addChangeListener(this.props.vm.monitorBlockListener);
        this.props.vm.addListener('SCRIPT_GLOW_ON', this.onScriptGlowOn);
        this.props.vm.addListener('SCRIPT_GLOW_OFF', this.onScriptGlowOff);
        this.props.vm.addListener('BLOCK_GLOW_ON', this.onBlockGlowOn);
        this.props.vm.addListener('BLOCK_GLOW_OFF', this.onBlockGlowOff);
        this.props.vm.addListener('VISUAL_REPORT', this.onVisualReport);
        this.props.vm.addListener('workspaceUpdate', this.onWorkspaceUpdate);
        this.props.vm.addListener('targetsUpdate', this.onTargetsUpdate);
        this.props.vm.addListener('EXTENSION_ADDED', this.handleExtensionAdded);
        this.props.vm.addListener('BLOCKSINFO_UPDATE', this.handleBlocksInfoUpdate);
        this.props.vm.addListener('PERIPHERAL_CONNECTED', this.handleStatusButtonUpdate);
        this.props.vm.addListener('PERIPHERAL_DISCONNECTED', this.handleStatusButtonUpdate);
    }
    detachVM () {
        this.props.vm.removeListener('SCRIPT_GLOW_ON', this.onScriptGlowOn);
        this.props.vm.removeListener('SCRIPT_GLOW_OFF', this.onScriptGlowOff);
        this.props.vm.removeListener('BLOCK_GLOW_ON', this.onBlockGlowOn);
        this.props.vm.removeListener('BLOCK_GLOW_OFF', this.onBlockGlowOff);
        this.props.vm.removeListener('VISUAL_REPORT', this.onVisualReport);
        this.props.vm.removeListener('workspaceUpdate', this.onWorkspaceUpdate);
        this.props.vm.removeListener('targetsUpdate', this.onTargetsUpdate);
        this.props.vm.removeListener('EXTENSION_ADDED', this.handleExtensionAdded);
        this.props.vm.removeListener('BLOCKSINFO_UPDATE', this.handleBlocksInfoUpdate);
        this.props.vm.removeListener('PERIPHERAL_CONNECTED', this.handleStatusButtonUpdate);
        this.props.vm.removeListener('PERIPHERAL_DISCONNECTED', this.handleStatusButtonUpdate);
    }

    updateToolboxBlockValue (id, value) {
        this.withToolboxUpdates(() => {
            const block = this.workspace
                .getFlyout()
                .getWorkspace()
                .getBlockById(id);
            if (block) {
                block.inputList[0].fieldRow[0].setValue(value);
            }
        });
    }

    onTargetsUpdate () {
        if (this.props.vm.editingTarget && this.workspace.getFlyout()) {
            ['glide', 'move', 'set'].forEach(prefix => {
                this.updateToolboxBlockValue(`${prefix}x`, Math.round(this.props.vm.editingTarget.x).toString());
                this.updateToolboxBlockValue(`${prefix}y`, Math.round(this.props.vm.editingTarget.y).toString());
            });
        }
    }
    onWorkspaceMetricsChange () {
        const target = this.props.vm.editingTarget;
        if (target && target.id) {
            const newMetric = {
                scrollX: this.workspace.scrollX,
                scrollY: this.workspace.scrollY,
                scale: this.workspace.scale
            };
            const oldMetric = this.state.workspaceMetrics[target.id];
            if (oldMetric && (
                oldMetric.scrollX !== newMetric.scrollX ||
                oldMetric.scrollY !== newMetric.scrollY ||
                oldMetric.scale !== newMetric.scale
            )) {
                return;
            }
            const workspaceMetrics = Object.assign({}, this.state.workspaceMetrics, {
                [target.id]: newMetric
            });
            this.setState({workspaceMetrics});
        }
    }
    onScriptGlowOn (data) {
        this.workspace.glowStack(data.id, true);
    }
    onScriptGlowOff (data) {
        this.workspace.glowStack(data.id, false);
    }
    onBlockGlowOn (data) {
        this.workspace.glowBlock(data.id, true);
    }
    onBlockGlowOff (data) {
        this.workspace.glowBlock(data.id, false);
    }
    onVisualReport (data) {
        this.workspace.reportValue(data.id, data.value);
    }
    getToolboxXML () {
        // Use try/catch because this requires digging pretty deep into the VM
        // Code inside intentionally ignores several error situations (no stage, etc.)
        // Because they would get caught by this try/catch
        try {
            let {editingTarget: target, runtime} = this.props.vm;
            const stage = runtime.getTargetForStage();
            if (!target) target = stage; // If no editingTarget, use the stage

            const stageCostumes = stage.getCostumes();
            const targetCostumes = target.getCostumes();
            const targetSounds = target.getSounds();
            const dynamicBlocksXML = this.props.vm.runtime.getBlocksXML();
            return makeToolboxXML(target.isStage, target.id, dynamicBlocksXML,
                targetCostumes[0].name,
                stageCostumes[0].name,
                targetSounds.length > 0 ? targetSounds[0].name : ''
            );
        } catch {
            return null;
        }
    }
    onWorkspaceUpdate (data) {
        // When we change sprites, update the toolbox to have the new sprite's blocks
        const toolboxXML = this.getToolboxXML();
        if (toolboxXML) {
            this.props.updateToolboxState(toolboxXML);
        }

        if (this.props.vm.editingTarget && !this.state.workspaceMetrics[this.props.vm.editingTarget.id]) {
            this.onWorkspaceMetricsChange();
        }

        // Remove and reattach the workspace listener (but allow flyout events)
        this.workspace.removeChangeListener(this.props.vm.blockListener);
        precacheTextWidths({ScratchBlocks: this.ScratchBlocks, xml: data.xml});
        const dom = this.ScratchBlocks.Xml.textToDom(data.xml);
        // console.log(dom);
        try {
            this.ScratchBlocks.Xml.clearWorkspaceAndLoadFromXml(dom, this.workspace);
        } catch (error) {
            // The workspace is likely incomplete. What did update should be
            // functional.
            //
            // Instead of throwing the error, by logging it and continuing as
            // normal lets the other workspace update processes complete in the
            // gui and vm, which lets the vm run even if the workspace is
            // incomplete. Throwing the error would keep things like setting the
            // correct editing target from happening which can interfere with
            // some blocks and processes in the vm.
            if (error.message) {
                error.message = `Workspace Update Error: ${error.message}`;
            }
            log.error(error);
        }
        precacheTextWidths.post({ScratchBlocks: this.ScratchBlocks});
        this.workspace.addChangeListener(this.props.vm.blockListener);

        if (this.props.vm.editingTarget && this.state.workspaceMetrics[this.props.vm.editingTarget.id]) {
            const {scrollX, scrollY, scale} = this.state.workspaceMetrics[this.props.vm.editingTarget.id];
            this.workspace.scrollX = scrollX;
            this.workspace.scrollY = scrollY;
            this.workspace.scale = scale;
            this.workspace.resize();
        }

        // Clear the undo state of the workspace since this is a
        // fresh workspace and we don't want any changes made to another sprites
        // workspace to be 'undone' here.
        this.workspace.clearUndo();
    }
    handleExtensionAdded (blocksInfo) {
        // select JSON from each block info object then reject the pseudo-blocks which don't have JSON, like separators
        // this actually defines blocks and MUST run regardless of the UI state
        this.ScratchBlocks.defineBlocksWithJsonArray(blocksInfo.map(blockInfo => blockInfo.json).filter(x => x));

        // Update the toolbox with new blocks
        const toolboxXML = this.getToolboxXML();
        if (toolboxXML) {
            this.props.updateToolboxState(toolboxXML);
        }
    }
    handleBlocksInfoUpdate (blocksInfo) {
        // @todo Later we should replace this to avoid all the warnings from redefining blocks.
        this.handleExtensionAdded(blocksInfo);
    }
    handleCategorySelected (categoryId) {
        const extension = extensionData.find(ext => ext.extensionId === categoryId);
        if (extension && extension.launchPeripheralConnectionFlow) {
            this.handleConnectionModalStart(categoryId);
        }

        this.withToolboxUpdates(() => {
            this.workspace.toolbox_.setSelectedCategoryById(categoryId);
        });
    }
    setBlocks (blocks) {
        this.blocks = blocks;
    }
    handlePromptStart (message, defaultValue, callback, optTitle, optVarType) {
        const p = {prompt: {callback, message, defaultValue}};
        p.prompt.title = optTitle ? optTitle :
            this.ScratchBlocks.Msg.VARIABLE_MODAL_TITLE;
        p.prompt.varType = typeof optVarType === 'string' ?
            optVarType : this.ScratchBlocks.SCALAR_VARIABLE_TYPE;
        p.prompt.showVariableOptions = // This flag means that we should show variable/list options about scope
            optVarType !== this.ScratchBlocks.BROADCAST_MESSAGE_VARIABLE_TYPE &&
            p.prompt.title !== this.ScratchBlocks.Msg.RENAME_VARIABLE_MODAL_TITLE &&
            p.prompt.title !== this.ScratchBlocks.Msg.RENAME_LIST_MODAL_TITLE;
        p.prompt.showCloudOption = (optVarType === this.ScratchBlocks.SCALAR_VARIABLE_TYPE) && this.props.canUseCloud;
        this.setState(p);
    }
    handleConnectionModalStart (extensionId) {
        this.props.onOpenConnectionModal(extensionId);
    }
    handleStatusButtonUpdate () {
        this.ScratchBlocks.refreshStatusButtons(this.workspace);
    }
    handleOpenSoundRecorder () {
        this.props.onOpenSoundRecorder();
    }

    /*
     * Pass along information about proposed name and variable options (scope and isCloud)
     * and additional potentially conflicting variable names from the VM
     * to the variable validation prompt callback used in scratch-blocks.
     */
    handlePromptCallback (input, variableOptions) {
        this.state.prompt.callback(
            input,
            this.props.vm.runtime.getAllVarNamesOfType(this.state.prompt.varType),
            variableOptions);
        this.handlePromptClose();
    }
    handlePromptClose () {
        this.setState({prompt: null});
    }
    handleCustomProceduresClose (data) {
        this.props.onRequestCloseCustomProcedures(data);
        const ws = this.workspace;
        ws.refreshToolboxSelection_();
        ws.toolbox_.scrollToCategoryById('myBlocks');
    }
    handleDrop (dragInfo) {
        fetch(dragInfo.payload.bodyUrl)
            .then(response => response.json())
            .then(blocks => this.props.vm.shareBlocksToTarget(blocks, this.props.vm.editingTarget.id))
            .then(() => {
                this.props.vm.refreshWorkspace();
                this.updateToolbox(); // To show new variables/custom blocks
            });
    }
    render () {
        /* eslint-disable no-unused-vars */
        const {
            anyModalVisible,
            canUseCloud,
            customProceduresVisible,
            extensionLibraryVisible,
            options,
            stageSize,
            vm,
            isRtl,
            isVisible,
            onActivateColorPicker,
            onOpenConnectionModal,
            onOpenSoundRecorder,
            updateToolboxState,
            onActivateCustomProcedures,
            onRequestCloseExtensionLibrary,
            onRequestCloseCustomProcedures,
            toolboxXML,
            ...props
        } = this.props;
        /* eslint-enable no-unused-vars */
        return (
            <React.Fragment>
                <DroppableBlocks
                    componentRef={this.setBlocks}
                    onDrop={this.handleDrop}
                    {...props}
                />
                {this.state.prompt ? (
                    <Prompt
                        defaultValue={this.state.prompt.defaultValue}
                        isStage={vm.runtime.getEditingTarget().isStage}
                        label={this.state.prompt.message}
                        showCloudOption={this.state.prompt.showCloudOption}
                        showVariableOptions={this.state.prompt.showVariableOptions}
                        title={this.state.prompt.title}
                        vm={vm}
                        onCancel={this.handlePromptClose}
                        onOk={this.handlePromptCallback}
                    />
                ) : null}
                {extensionLibraryVisible ? (
                    <ExtensionLibrary
                        vm={vm}
                        onCategorySelected={this.handleCategorySelected}
                        onRequestClose={onRequestCloseExtensionLibrary}
                    />
                ) : null}
                {customProceduresVisible ? (
                    <CustomProcedures
                        options={{
                            media: options.media
                        }}
                        onRequestClose={this.handleCustomProceduresClose}
                    />
                ) : null}
            </React.Fragment>
        );
    }
}

Blocks.propTypes = {
    anyModalVisible: PropTypes.bool,
    canUseCloud: PropTypes.bool,
    customProceduresVisible: PropTypes.bool,
    extensionLibraryVisible: PropTypes.bool,
    isRtl: PropTypes.bool,
    isVisible: PropTypes.bool,
    locale: PropTypes.string.isRequired,
    messages: PropTypes.objectOf(PropTypes.string),
    onActivateColorPicker: PropTypes.func,
    onActivateCustomProcedures: PropTypes.func,
    onOpenConnectionModal: PropTypes.func,
    onOpenSoundRecorder: PropTypes.func,
    onRequestCloseCustomProcedures: PropTypes.func,
    onRequestCloseExtensionLibrary: PropTypes.func,
    options: PropTypes.shape({
        media: PropTypes.string,
        zoom: PropTypes.shape({
            controls: PropTypes.bool,
            wheel: PropTypes.bool,
            startScale: PropTypes.number
        }),
        colours: PropTypes.shape({
            workspace: PropTypes.string,
            flyout: PropTypes.string,
            toolbox: PropTypes.string,
            toolboxSelected: PropTypes.string,
            scrollbar: PropTypes.string,
            scrollbarHover: PropTypes.string,
            insertionMarker: PropTypes.string,
            insertionMarkerOpacity: PropTypes.number,
            fieldShadow: PropTypes.string,
            dragShadowOpacity: PropTypes.number
        }),
        comments: PropTypes.bool,
        collapse: PropTypes.bool
    }),
    stageSize: PropTypes.oneOf(Object.keys(STAGE_DISPLAY_SIZES)).isRequired,
    toolboxXML: PropTypes.string,
    updateToolboxState: PropTypes.func,
    vm: PropTypes.instanceOf(VM).isRequired
};

Blocks.defaultOptions = {
    zoom: {
        controls: true,
        wheel: true,
        startScale: 0.675
    },
    grid: {
        spacing: 40,
        length: 2,
        colour: '#ddd'
    },
    colours: {
        workspace: '#F9F9F9',
        flyout: '#F9F9F9',
        toolbox: '#FFFFFF',
        toolboxSelected: '#E9EEF2',
        scrollbar: '#CECDCE',
        scrollbarHover: '#CECDCE',
        insertionMarker: '#000000',
        insertionMarkerOpacity: 0.2,
        fieldShadow: 'rgba(255, 255, 255, 0.3)',
        dragShadowOpacity: 0.6
    },
    comments: true,
    collapse: false,
    sounds: false
};

Blocks.defaultProps = {
    isVisible: true,
    options: Blocks.defaultOptions
};

const mapStateToProps = state => ({
    anyModalVisible: (
        Object.keys(state.scratchGui.modals).some(key => state.scratchGui.modals[key]) ||
        state.scratchGui.mode.isFullScreen
    ),
    extensionLibraryVisible: state.scratchGui.modals.extensionLibrary,
    isRtl: state.locales.isRtl,
    locale: state.locales.locale,
    messages: state.locales.messages,
    toolboxXML: state.scratchGui.toolbox.toolboxXML,
    customProceduresVisible: state.scratchGui.customProcedures.active
});

const mapDispatchToProps = dispatch => ({
    onActivateColorPicker: callback => dispatch(activateColorPicker(callback)),
    onActivateCustomProcedures: (data, callback) => dispatch(activateCustomProcedures(data, callback)),
    onOpenConnectionModal: id => {
        dispatch(setConnectionModalExtensionId(id));
        dispatch(openConnectionModal());
    },
    onOpenSoundRecorder: () => {
        dispatch(activateTab(SOUNDS_TAB_INDEX));
        dispatch(openSoundRecorder());
    },
    onRequestCloseExtensionLibrary: () => {
        dispatch(closeExtensionLibrary());
    },
    onRequestCloseCustomProcedures: data => {
        dispatch(deactivateCustomProcedures(data));
    },
    updateToolboxState: toolboxXML => {
        dispatch(updateToolbox(toolboxXML));
    }
});

export default errorBoundaryHOC('Blocks')(
    connect(
        mapStateToProps,
        mapDispatchToProps
    )(Blocks)
);
