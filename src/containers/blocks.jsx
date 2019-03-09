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

const virtualizeCreateSvgElement = (ScratchBlocks) => {
    // const endBlockDrag = ScratchBlocks.BlockDragger.prototype.endBlockDrag;
    // ScratchBlocks.BlockDragger.prototype.endBlockDrag = function (...args) {
    //     console.log('endBlockDrag', args);
    //     return endBlockDrag.call(this, ...args);
    // };

    const virtualStyleProxyHandler = {
        get (target, key) {
            if (key in target) {
                return target[key];
            } else if (key in target.style) {
                console.warn('key not in VirtualStyle:', key);
                return target.style;
            } else if (target.real) {
                if (!(key in target.real)) {
                    throw new Error('unsupported style: ' + key)
                }
                return target.real[key];
            }
            return '';
            // return target.style[key];
        },

        set (target, key, value) {
            if (key in target) {
                target[key] = value;
            } else {
                console.warn('key not in VirtualStyle:', key);
                target.style[key] = value;
            }
            if (target.real) {
                target.real[key] = value;
            }
            return true;
        },

        deleteProperty (target, key) {
            delete target.style[key];
            if (target.real) {
                delete target.real[key];
            }
            return true;
        }
    };

    class VirtualStyle {
        constructor () {
            this.style = {};
            this.real = null;
            // this.proxy = new Proxy(this, virtualStyleProxyHandler);
            this.proxy = this;
        }

        setReal (real) {
            if (!this.real && real) {
                for (const key in this.style) {
                    real[key] = this.style[key];
                }
            }
            if (this.real && !real) {
                for (const key in this.style) {
                    delete this.real[key];
                }
            }
            this.real = real;
        }

        get fill () {
            return this.style.fill;
        }

        set fill (value) {
            this.style.fill = value;
            if (this.real !== null) {
                this.real[value] = value;
            }
        }

        get id () {
            return this.style.id;
        }

        set id (value) {
            this.style.id = value;
            if (this.real !== null) {
                this.real[value] = value;
            }
        }

        get cursor () {
            return this.style.cursor;
        }

        set cursor (value) {
            this.style.cursor = value;
            if (this.real !== null) {
                this.real[value] = value;
            }
        }
    }

    class VirtualSvgAnimatedString {
        constructor (key, attributes) {
            this.key = key;
            this.attributes = attributes;
            this.real = null;
        }

        setReal (real) {
            // if (!this.real && real && this.key in this.attributes) {
            //     real.baseVal = this.attributes[this.key];
            // }
            // if (this.real && !real && this.key in this.attributes) {
            //     real.baseVal = '';
            // }
            this.real = real;
        }

        get baseVal () {
            return this.attributes[this.key];
        }

        set baseVal (value) {
            if (!attributeSetStyleMap.class) {
                initAttributeSetStyle('class', this.real);
            }
            this.attributes[this.key] = value;
            if (this.real !== null) {
                this.real.baseVal = value;
            }
        }
    }

    const virtualElementProxy = {
        get (target, key) {
            if (key in target) {
                return target[key];
            } else if (target.real) {
                console.warn('key supported dynamically:', key);
                const property = target.real[key];
                if (typeof property === 'function') {
                    return property.bind(target.real);
                }
                return property;
            } else if (key in target.properties) {
                return target.properties[key];
            } else {
                throw new Error('non-virtualized key: ' + key);
            }
        },

        set (target, key, value) {
            if (key in target) {
                target[key] = value;
            } else {
                console.warn('non-virtualized key:', key);
                target.properties[key] = value;
                if (target.real) {
                    target.real[key] = value;
                } else {
                    // console.log('property', key, value);
                }
            }
            return true;
        }
    };

    const elementMap = new WeakMap();

    const ElementFeatures = {
        ATTRIBUTES: 1,
        ATTRIBUTESNS: 2,
        CHILDREN: 4,
        EVENTS: 8,
        STYLE: 16,
        PROPERTIES: 32,
        DATASET: 64,
        CLASSNAME: 128
    };

    const AttributeSetStyle = {
        UNKNOWN: 0,
        ANIMATED: 1,
        ANIMATED_LENGTH: 2,
        CLASSNAME: 3,
        PROPERTY: 4,
        SET_ATTRIBUTE: 6
    };

    const attributeSetStyleMap = {};

    const initAttributeSetStyle = function (key, el) {
        // attributeSetStyleMap[key] = AttributeSetStyle.SET_ATTRIBUTE;
        // return;
        if (el[key] instanceof SVGAnimatedString) {
            // console.log('string', key, el[key].constructor.name, el);
            attributeSetStyleMap[key] = AttributeSetStyle.ANIMATED;
        } else if (el[key] instanceof SVGAnimatedLength) {
            // console.log('length', key, el[key].constructor.name, el);
            attributeSetStyleMap[key] = AttributeSetStyle.ANIMATED_LENGTH;
        } else if (key === 'class') {
            // console.log('classname', key, el.className.constructor.name, el);
            attributeSetStyleMap[key] = AttributeSetStyle.CLASSNAME;
        } else if (typeof el[key] === 'string' || el[key] instanceof CSSStyleDeclaration) {
            // console.log('property', key, el[key].constructor.name, el);
            attributeSetStyleMap[key] = AttributeSetStyle.PROPERTY;
        } else {
            // console.log('set', key, el[key] && el[key].constructor.name, el);
            attributeSetStyleMap[key] = AttributeSetStyle.SET_ATTRIBUTE;
        }
    };

    class VirtualSvgElement {
        constructor (tagName) {
            this.tagName = tagName;
            this._elementMode = 0;
            this._members = 0;
            this.attached = false;
            this.destroyPending = false;
            this._children = null;
            this._childNodes = null;
            this.properties = null;
            this.attributes = null;
            this.attributeKeys = null;
            this.attributesNS = null;
            this.events = null;
            this._className = null;
            this._style = null;
            this._dataset = null;
            // this._textContent = null;
            this._tooltip = undefined;
            this._translate_ = undefined;
            this._skew_ = undefined;
            this.parent = null;
            this.real = null;
            // this.proxy = new Proxy(this, virtualElementProxy);
            this.proxy = this;
        }

        attach () {
            if (this.attached) return;
            this.attached = true;
            if ((this._elementMode & ElementFeatures.CHILDREN) > 0) {
                for (let i = 0; i < this._children.length; i++) {
                    this._children[i].attach && this._children[i].attach();
                }
            }
        }

        detach () {
            if (!this.attached) return;
            this.attached = false;
            if ((this._elementMode & ElementFeatures.CHILDREN) > 0) {
                for (let i = 0; i < this._children.length; i++) {
                    this._children[i].detach && this._children[i].detach();
                }
            }
        }

        _setParent (parent) {
            if (parent !== null && this.parent !== null && parent !== this.parent && this.parent instanceof VirtualSvgElement) {
                // this.parent.removeChild(this);
                const index = this.parent._children.indexOf(this);
                if (index > -1) {
                    this.parent._children.splice(index, 1);
                }
            }
            if (!this.parent && parent) {
                this.attach();
            } else if (this.parent && !parent) {
                this.detach();
            }
            this.parent = parent;
            if (parent !== null && (parent.real !== null || parent instanceof Element) && this.destroyPending) {
                _destroySvgElement.revoke(this);
            }
            if (parent !== null && (parent.real !== null || parent instanceof Element) && this.real === null) {
                this.real = _createSvgElement(this.tagName);
                elementMap.set(this.real, this);
                // this.real.debugObject = this;
                ((this._elementMode & ElementFeatures.CLASSNAME) > 0) &&
                    this._className.setReal(this.real.className);
                ((this._elementMode & ElementFeatures.STYLE) > 0) &&
                    this._style.setReal(this.real.style);
                ((this._elementMode & ElementFeatures.DATASET) > 0) &&
                    this._dataset.setReal(this.real.dataset);
                if ((this._elementMode & ElementFeatures.PROPERTIES) > 0) {
                    for (const key in this.properties) {
                        this.real[key] = this.properties[key];
                    }
                }
                // if (this._textContent !== null) {
                //     this.real.textContent = this._textContent;
                // }
                if ((this._elementMode & ElementFeatures.ATTRIBUTES) > 0) {
                    for (let i = 0; i < this.attributeKeys.length; i++) {
                        const key = this.attributeKeys[i];
                        if (!attributeSetStyleMap[key]) {
                            initAttributeSetStyle(key, this.real);
                        }
                        switch (attributeSetStyleMap[key]) {
                        case AttributeSetStyle.ANIMATED:
                            this.real[key].baseVal = this.attributes[key];
                            break;
                        case AttributeSetStyle.CLASSNAME:
                            this.real.className.baseVal = this.attributes[key];
                            break;
                        case AttributeSetStyle.PROPERTY:
                            this.real[key] = this.attributes[key];
                            break;
                        default:
                            this.real.setAttribute(key, this.attributes[key]);
                            break;
                        }
                        // const attr = _createAttribute(key);
                        // attr.value = this.attributes[key];
                        // this.real.attributes.setNamedItem(attr);
                        // this.real.setAttribute(key, this.attributes[key]);
                    }
                }
                if ((this._elementMode & ElementFeatures.ATTRIBUTESNS) > 0) {
                    for (const ns in this.attributesNS) {
                        for (const key in this.attributesNS[ns]) {
                            this.real.setAttributeNS(ns, key, this.attributesNS[ns][key]);
                        }
                    }
                }
                if ((this._elementMode & ElementFeatures.CHILDREN) > 0) {
                    for (const child of this._children) {
                        let el = child;
                        if (child instanceof VirtualSvgElement) {
                            el = child._setParent(this);
                        }
                        this.real.appendChild(el);
                    }
                }
                if ((this._elementMode & ElementFeatures.EVENTS) > 0) {
                    for (const [event, listener, capture] of this.events) {
                        this.real.addEventListener(event, listener, capture);
                    }
                }
            } else if ((parent === null || (parent instanceof VirtualSvgElement && parent.real === null)) && this.real !== null) {
                _destroySvgElement(this);
            }
            return this.real;
        }

        _cleanFastReal () {
            this.real = null;
            if (this._children) {
                for (const child of this._children) {

                    if (child instanceof VirtualSvgElement) {
                        child._setParent(this);
                    }
                }
            }
        }

        _cleanReal () {
            try {
            // this.real.parentNode && this.real.parentNode.removeChild(this.real);
            let i = 0;
            if ((this._elementMode & ElementFeatures.PROPERTIES) > 0) {
                for (const key in this.properties) {

                    delete this.real[key];
                }
            }
            // if (this._textContent !== null) {
            //
            //     this.real.textContent = '';
            // }
            if ((this._elementMode & ElementFeatures.ATTRIBUTES) > 0) {
                for (let i = 0; i < this.attributeKeys.length; i++) {
                    const key = this.attributeKeys[i];
                    // _destroyAttribute(this.real.attributes.removeNamedItem(key));
                    this.real.removeAttribute(key);
                }
            }
            if ((this._elementMode & ElementFeatures.ATTRIBUTESNS) > 0) {
                for (const ns in this.attributesNS) {
                    for (const key in this.attributesNS[ns]) {

                        this.real.removeAttributeNS(ns, key);
                    }
                }
            }
            if ((this._elementMode & ElementFeatures.EVENTS) > 0) {
                for (const [event, listener, change] of this.events) {

                    this.real.removeEventListener(event, listener, change);
                }
            }
            if ((this._elementMode & ElementFeatures.STYLE) > 0) {
                this.real.style = '';
                this._style.real = null;
            }
            const real = this.real;
            this.real = null;
            ((this._elementMode & ElementFeatures.CLASSNAME) > 0) && this._className.setReal(null);
            ((this._elementMode & ElementFeatures.DATASET) > 0) && this._dataset.setReal(null);
            if ((this._elementMode & ElementFeatures.CHILDREN) > 0) {
                for (const child of this._children) {
                    if (child instanceof VirtualSvgElement) {
                        // real.removeChild(child.real);
                        const el = child._setParent(this);
                        el.parentNode && el.parentNode.removeChild(el);
                    } else if (child.parentNode) {
                        child.parentNode.removeChild(child);
                    }
                }
            }
            } catch (e) {console.error(e);}
        }

        initAttributes () {
            this._elementMode |= ElementFeatures.ATTRIBUTES;
            this.attributes = {};
            this.attributeKeys = [];
        }

        get id () {
            if ((this._elementMode & ElementFeatures.ATTRIBUTES) === 0) this.initAttributes();
            return this.attributes.id;
        }

        set id (value) {
            if ((this._elementMode & ElementFeatures.ATTRIBUTES) === 0) this.initAttributes();
            this.attributes.id = value;
            return value;
        }

        get type () {
            return this.real.type;
        }

        get isContentEditable () {
            return this.real.isContentEditable;
        }

        initClassName () {
            this._elementMode |= ElementFeatures.CLASSNAME;
            if ((this._elementMode & ElementFeatures.ATTRIBUTES) === 0) this.initAttributes();
            this._className = new VirtualSvgAnimatedString('class', this.attributes);
        }

        get className () {
            if ((this._elementMode & ElementFeatures.CLASSNAME) === 0) this.initClassName();
            return this._className;
        }

        get firstChild () {
            if ((this._elementMode & ElementFeatures.CHILDREN) === 0) this.initChildren();
            return this._children[0];
        }

        get previousSibling () {
            if (this.real !== null) {
                return this.real.previousSibling;
            }
            const index = this.parent._children.indexOf(this);
            return this.parent._children[index - 1];
        }

        get nextSibling () {
            const index = this.parent._children.indexOf(this);
            return this.parent._children[index + 1];
        }

        initStyle () {
            this._elementMode |= ElementFeatures.STYLE;
            this._style = new VirtualStyle();
            if (this.real !== null) {
                this._style.setReal(this.real.style);
            }
        }

        get style () {
            if ((this._elementMode & ElementFeatures.STYLE) === 0) this.initStyle();
            return this._style.proxy;
        }

        initDataset () {
            this._elementMode |= ElementFeatures.DATASET;
            this._dataset = new VirtualStyle();
            if (this.real !== null) {
                this._dataset.setReal(this.real.dataset);
            }
        }

        get dataset () {
            if ((this._elementMode & ElementFeatures.DATASET) === 0) this.initDataset();
            return this._dataset.proxy;
        }

        get parentElement () {
            return this.parent;
        }

        set parentElement (value) {
            throw new Error('parentElement');
        }

        get parentNode () {
            return this.parent;
        }

        set parentNode (value) {
            throw new Error('parentNode');
        }

        initProperties () {
            this._elementMode |= ElementFeatures.PROPERTIES;
            this.properties = {
                textContent: ''
            };
        }

        get textContent () {
            if ((this._elementMode & ElementFeatures.PROPERTIES) === 0) this.initProperties();
            return this.properties.textContent;
        }

        set textContent (value) {
            if ((this._elementMode & ElementFeatures.PROPERTIES) === 0) this.initProperties();
            this.properties.textContent = value;
            if (this.real !== null) {
                this.real.textContent = value;
            }
        }

        get tooltip () {
            return this._tooltip;
            if ((this._elementMode & ElementFeatures.PROPERTIES) === 0) this.initProperties();
            return this.properties.tooltip;
        }

        set tooltip (value) {
            return this._tooltip = value;
            if ((this._elementMode & ElementFeatures.PROPERTIES) === 0) this.initProperties();
            this.properties.tooltip = value;
            if (this.real !== null) {
                this.real.tooltip = value;
            }
        }

        get translate_ () {
            return this._translate_;
            if ((this._elementMode & ElementFeatures.PROPERTIES) === 0) this.initProperties();
            return this.properties.translate_;
        }

        set translate_ (value) {
            return this._translate_ = value;
            if ((this._elementMode & ElementFeatures.PROPERTIES) === 0) this.initProperties();
            this.properties.translate_ = value;
            if (this.real !== null) {
                this.real.translate_ = value;
            }
        }

        get skew_ () {
            return this._skew_;
            if ((this._elementMode & ElementFeatures.PROPERTIES) === 0) this.initProperties();
            return this.properties.skew_;
        }

        set skew_ (value) {
            return this._skew_ = value;
            if ((this._elementMode & ElementFeatures.PROPERTIES) === 0) this.initProperties();
            this.properties.skew_ = value;
            if (this.real !== null) {
                this.real.skew_ = value;
            }
        }

        get nodeType () {
            return Element.ELEMENT_NODE;
        }

        get ownerDocument () {
            return this.real.ownerDocument;
        }

        get ownerSVGElement () {
            return this.real.ownerSVGElement;
        }

        get getComputedTextLength () {
            return this.real.getComputedTextLength.bind(this.real);
        }

        get getBoundingClientRect () {
            return this.real.getBoundingClientRect.bind(this.real);
        }

        hasAttribute (key) {
            if ((this._elementMode & ElementFeatures.ATTRIBUTES) === 0) this.initAttributes();
            return key in this.attributes;
        }

        getAttribute (key) {
            if ((this._elementMode & ElementFeatures.ATTRIBUTES) === 0) this.initAttributes();
            // console.log('getAttribute', key);
            // if (this.real !== null) {
            //     return this.real.getAttribute(key);
            // }
            return this.attributes[key];
        }

        setAttribute (key, value) {
            if ((this._elementMode & ElementFeatures.ATTRIBUTES) === 0) this.initAttributes();
            // console.log('setAttribute', key, value);
            if (!this.attributes[key]) {
                this._members += 1;
                this.attributeKeys.push(key);
            // } else if (this.real === null) {
            //     console.log('repeat setAttribute in nonreal', key);
            // } else if (!this.attached) {
            //     console.log('repeat setAttribute while detached', key);
            // } else {
            //     console.log('repeat setAttribute after real', key);
            }
            this.attributes[key] = value;
            if (this.real !== null) {
                if (!attributeSetStyleMap[key]) {
                    initAttributeSetStyle(key, this.real);
                }
                switch (attributeSetStyleMap[key]) {
                case AttributeSetStyle.ANIMATED:
                    this.real[key].baseVal = value;
                    break;
                case AttributeSetStyle.CLASSNAME:
                    this.real.className.baseVal = value;
                    break;
                case AttributeSetStyle.PROPERTY:
                    this.real[key] = value;
                    break;
                case AttributeSetStyle.ANIMATED_LENGTH:
                    if (this.real[key].baseVal.length) {
                        this.real[key].baseVal[0].valueAsString = value;
                        break;
                    }
                default:
                    this.real.setAttribute(key, value);
                    break;
                }
                // const attr = _createAttribute(key);
                // attr.value = value;
                // this.real.attributes.setNamedItem(attr);
                // this.real.setAttribute(key, value);
            }
            return value;
        }

        removeAttribute (key) {
            if ((this._elementMode & ElementFeatures.ATTRIBUTES) === 0) this.initAttributes();
            if (this.attributes[key]) {
                this._members -= 1;
                this.attributeKeys.splice(this.attributeKeys.indexOf(key), 1);
            }
            delete this.attributes[key];
            if (this.real !== null) {
                // _destroyAttribute(this.real.attributes.removeNamedItem(key));
                this.real.removeAttribute(key);
            }
        }

        initAttributesNS () {
            this._elementMode |= ElementFeatures.ATTRIBUTESNS;
            this.attributesNS = {};
        }

        setAttributeNS (ns, key, value) {
            // return this.setAttribute(key.substring(6), value);
            if ((this._elementMode & ElementFeatures.ATTRIBUTESNS) === 0) this.initAttributesNS();
            if (!this.attributesNS[ns]) {
                this.attributesNS[ns] = {};
            }
            this.attributesNS[ns][key] = value;
            if (this.real !== null) {
                this.real.setAttributeNS(ns, key, value);
            }
        }

        initEvents () {
            this._elementMode |= ElementFeatures.EVENTS;
            this.events = [];
        }

        addEventListener (event, _listener, capture) {
            if ((this._elementMode & ElementFeatures.EVENTS) === 0) this.initEvents();
            const index = this.events.findIndex(item => (item[0] === event && (item[1] === _listener || item[1].wrapped === _listener) && item[2] === capture));
            if (index > -1) {
                console.warn('adding event listner, ' + event + ' an extra time', this);
            }
            const _this = this;
            const listener = function (e) {
                // console.log(event, _listener.toString(), capture, e);
                // return _listener.call(this, e);
                const target = elementMap.get(e.target);
                if (!target) {
                    console.warn('couldnt locate virtualized event target');
                    return _listener.call(this, e);
                }
                const {
                    changedTouches,
                    deltaMode,
                    deltaX,
                    deltaY,
                    shiftKey,
                    ctrlKey,
                    button,
                    type,
                    clientX,
                    clientY
                } = e;
                return _listener.call(this, new Proxy({
                    changedTouches,
                    deltaMode,
                    deltaX,
                    deltaY,
                    shiftKey,
                    ctrlKey,
                    button,
                    type,
                    clientX,
                    clientY,
                    target: target,
                    stopPropagation: function () { e.stopPropagation(); },
                    preventDefault: function () { e.preventDefault(); }
                }, {
                    get (target, key) {
                        if (key in target) {
                            return target[key];
                        }
                        console.info('event.' + key);
                        if (typeof e[key] === 'function') {
                            return e[key].bind(e);
                        }
                        return e[key];
                    }
                }));
            };
            listener.wrapped = _listener;
            this.events.push([event, listener, capture]);
            if (this.real !== null) {
                this.real.addEventListener(event, listener, capture);
            }
        }

        removeEventListener (_event, _listener, _capture) {
            if ((this._elementMode & ElementFeatures.EVENTS) === 0) this.initEvents();
            const index = this.events.findIndex(item => (item[0] === _event && (item[1] === _listener || item[1].wrapped === _listener) && item[2] === _capture));
            const [event, listener, capture] = this.events[index];
            if (index > -1) {
                this.events.splice(index, 1);
            } else {
                console.warn('removing non-contained event listener', event, listener);
            }
            if (this.real !== null) {
                this.real.removeEventListener(event, listener, capture);
            }
        }

        initChildren () {
            this._elementMode |= ElementFeatures.CHILDREN;
            this._children = [];
            this._childNodes = this._children;
        }

        get children () {
            if ((this._elementMode & ElementFeatures.CHILDREN) === 0) this.initChildren();
            return this._children;
        }

        get childNodes () {
            if ((this._elementMode & ElementFeatures.CHILDREN) === 0) this.initChildren();
            return this._childNodes;
        }

        insertBefore (el, before) {
            if ((this._elementMode & ElementFeatures.CHILDREN) === 0) this.initChildren();
            if (!(el instanceof VirtualSvgElement)) {
                el = elementMap.get(el) || el;
            }
            if (!(before instanceof VirtualSvgElement)) {
                before = elementMap.get(before) || before;
            }
            const index = this._children.indexOf(before);
            if (index > -1) {
                this._children.splice(index, 0, el);
            } else {
                this._children.push(el);
            }
            if (el instanceof VirtualSvgElement) {
                el = el._setParent(this);
            } else {
                console.warn('non virtual insert', el);
            }
            if (this.real !== null) {
                if (before instanceof VirtualSvgElement) {
                    if (!before.real) throw new Error('inserting into real element with virtual reference node');
                    before = before.real;
                }
                this.real.insertBefore(el, before);
            }
        }

        appendChild (el) {
            if ((this._elementMode & ElementFeatures.CHILDREN) === 0) this.initChildren();
            if (!(el instanceof VirtualSvgElement)) {
                el = elementMap.get(el) || el;
            }
            this._children.push(el);
            if (el instanceof VirtualSvgElement) {
                if (el.real) {
                    // debugger;
                }
                el = el._setParent(this);
            } else if (!(el instanceof Text)) {
                console.warn('non virtual append', el);
            }
            if (this.real !== null) {
                this.real.appendChild(el);
            }
            // debugger;
        }

        removeChild (el) {
            if ((this._elementMode & ElementFeatures.CHILDREN) === 0) this.initChildren();
            if (!(el instanceof VirtualSvgElement)) {
                el = elementMap.get(el) || el;
            }
            const index = this._children.indexOf(el);
            if (index > -1) {
                this._children.splice(index, 1);
            }
            let _el = el;
            if (el instanceof VirtualSvgElement) {
                _el = el.real;
                el._setParent(null);
            }
            if (this.real !== null) {
                this.real.removeChild(_el);
            }
        }

        contains (el) {
            if ((this._elementMode & ElementFeatures.CHILDREN) === 0) this.initChildren();
            if (this.real !== null) {
                if (el instanceof VirtualSvgElement) {
                    el = el.real;
                }
                return this.real.contains(el);
            }
            console.warn('contains');
            return this._children.indexOf(el);
        }

        replaceChild () {
            throw new Error('replaceChild');
        }

        cloneNode (...args) {
            if (this.real !== null) {
                return initSvgSvgElement(this.real.cloneNode(...args));
            }
            throw new Error('cloneNode');
        }
    }

    const initSvgSvgElement = function (svgElement) {
        const map = new Map();

        const insertBefore = svgElement.insertBefore;
        svgElement.insertBefore = function (el, before) {
            let _el = el;
            if (_el instanceof VirtualSvgElement) {
                _el = el._setParent(svgElement);
                map.set(_el, el);
            }
            if (before instanceof VirtualSvgElement) {
                if (!before.real) throw new Error('inserting with virtual reference');
                before = before._setParent(svgElement);

            }
            insertBefore.call(svgElement, _el, before);
        };

        const appendChild = svgElement.appendChild;
        svgElement.appendChild = function (el) {
            let _el = el;
            if (_el instanceof VirtualSvgElement) {
                _el = el._setParent(svgElement);
                map.set(_el, el);
            }
            if (!(_el instanceof Element)) {
                debugger;
            }
            appendChild.call(svgElement, _el);
            // debugger;
        };

        const removeChild = svgElement.removeChild;
        svgElement.removeChild = function (_el) {
            let el = _el;
            if (el instanceof VirtualSvgElement) {
                if (!el.real) throw new Error('removing with non-real element');
                _el = el.real;
            } else {
                el = map.get(_el);
            }
            removeChild.call(svgElement, _el);
            if (el) {
                el._setParent(null);
            }
            map.delete(_el);
        };

        const contains = svgElement.contains;
        svgElement.contains = function (el) {
            console.warn('contains');
            let _el = el;
            if (el instanceof VirtualSvgElement) {
                if (!el.real) return false;
                _el = el.real;
            }
            return contains.call(svgElement, _el);
        };

        svgElement.replaceChild = function () {
            throw new Error('replaceChild');
        };

        svgElement.cloneNode = function () {
            throw new Error('cloneNode');
        };

        return svgElement;
    };

    class CacheNode {
        add () {

        }

        remove () {

        }
    }

    const _cacheUse = window.svgCacheUse = {
        new: 0,
        low: 0,
        lowPush: 0,
        high: 0,
        highPush: 0,
        newAttr: 0,
        attr: 0,
        attrPush: 0
    };

    const _attrCache = window.svgAttributeCache = {};
    const _createAttribute = function (name) {
        const _cached = _attrCache[name] && _attrCache[name].pop();
        if (_cached) {
            _cacheUse.attr += 1;
            return _cached;
        }
        _cacheUse.newAttr += 1;
        return document.createAttribute(name);
    };

    const _destroyAttribute = function (attr) {
        const {name} = attr;
        if (!_attrCache[name]) {
            _attrCache[name] = [];
        }
        _cacheUse.attrPush += 1;
        _attrCache[name].push(attr);
    };

    const _cache = window.svgElementCache = {};
    const _highCache = window.svgHighElementCache = {};
    const _createSvgElement = function (name) {
        let _cached = _cache[name] && _cache[name].pop()
        if (_cached) {
            _cacheUse.low += 1;
        } else {
            _cached = _highCache[name] && _highCache[name].pop();
            if (_cached) {
                _cacheUse.high += 1;
            }
        }
        if (_cached) {
            _cached.destroyPending = false;
            let el = _cached.real;
            _cached._cleanReal();
            return el;
        }
        _cacheUse.new += 1;
        return document.createElementNS(ScratchBlocks.SVG_NS, name);
    };

    const _destroySvgElement = function (el) {
        // el._cleanReal();
        // return;
        el.destroyPending = true;
        const {tagName, _members} = el;
        if (_members < 2) {
            if (!_cache[tagName]) {
                _cache[tagName] = [];
            }
            const index = _cache[tagName].indexOf(el);
            if (index === -1) {
                _cacheUse.lowPush += 1;
                _cache[tagName].push(el);
            }
        } else {
            if (!_highCache[tagName]) {
                _highCache[tagName] = [];
            }
            const index = _highCache[tagName].indexOf(el);
            if (index === -1) {
                _cacheUse.highPush += 1;
                _highCache[tagName].push(el);
            }
        }
    };

    _destroySvgElement.revoke = function (el) {
        const {tagName} = el;
        const index = _cache[tagName].indexOf(el);
        if (index > -1) {
            _cache[tagName].splice(index, 1);
            el.destroyPending = false;
        } else {
            const highIndex = _highCache[tagName].highIndexOf(el);
            if (highIndex > -1) {
                _highCache[tagName].splice(highIndex, 1);
                el.destroyPending = false;
            }
        }
    };

    const _initElement = function (el, attrs, parent) {
        for (const key in attrs) {
            el.setAttribute(key, attrs[key]);
        }
        if (parent) {
            parent.appendChild(el);
        }
        return el;
    };

    ScratchBlocks.utils.createSvgElement = function (name, attrs, parent) {
        if (name === 'svg') {
            return _initElement(initSvgSvgElement(_createSvgElement(name)), attrs, parent);
        } else {
            return _initElement(new VirtualSvgElement(name).proxy, attrs, parent);
        }
    };
};

let early = true;
let p;

const hijackCreateSvgElementEventListener = (ScratchBlocks, root) => {
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
            const el = createSvgElement.call(this, name, attrs, parent);
            // const el = document.createElementNS(ScratchBlocks.SVG_NS, name);

            el.addEventListener = elAddEventListener;
            return el;

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
};

const hijackCreateSvgElement = function (ScratchBlocks) {
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

hijackCreateSvgElementEventListener.post = function (ScratchBlocks) {
    if (!p || !p._defer) return;
    for (let i = 0; i < p._defer.length; i++) {
        p._defer[i]();
    }
    p._defer = null;
};

const hijackTextToDOM = function (ScratchBlocks) {
    const parseXml = require('@rgrove/parse-xml');

    const xmlvProxy = {
        get (target, key) {
            if (key in target) {
                return target[key];
            } else {
                console.warn('unmatched xml get proxy key', key, target);
            }
        },

        set (target, key, value) {
            if (key in target) {
                return target[key] = value;
            } else {
                console.warn('unmatched xml set proxy key', key, target);
            }
        }
    };

    // class XMLVBase {
    //     constructor (raw) {
    //         this.raw = raw;
    //         this._childNodes = null;
    //         this._children = null;
    //         // this.proxy = new Proxy(this, xmlvProxy);
    //     }
    //
    //     get tagName () {
    //         return this.raw.name;
    //     }
    //
    //     get childNodes () {
    //         if (this._childNodes === null) {
    //             this._childNodes = this.raw.children.map(XMLVBase.cast);
    //         }
    //         return this._childNodes;
    //     }
    //
    //     get children () {
    //         if (this._children === null) {
    //             this._children = this.childNodes.filter(node => node instanceof XMLVElement);
    //         }
    //         return this._children;
    //     }
    //
    //     get firstChild () {
    //         return this.children[0];
    //     }
    //
    //     getAttribute (key) {
    //         return this.raw.attributes && this.raw.attributes[key];
    //     }
    //
    //     setAttribute (key, value) {
    //         if (!this.raw.attributes) {
    //             this.raw.attributes = {};
    //         }
    //         return this.raw.attributes[key] = value;
    //     }
    //
    //     getElementsByTagName (tagName) {
    //         return (this.tagName === tagName ? [this] : []).concat(...this.children.map(child => child.getElementsByTagName(tagName)));
    //     }
    //
    //     static cast (raw) {
    //         return new (constructors[raw.type] || XMLVBase)(raw);
    //     }
    // }
    //
    // class XMLVDocument extends XMLVBase {
    //     get nodeName () {
    //         return '#document';
    //     }
    //
    //     get nodeType () {
    //         // return document.DOCUMENT_FRAGMENT_NODE;
    //         return 11;
    //     }
    // }
    //
    // class XMLVElement extends XMLVBase {
    //     get nodeType () {
    //         // return document.ELEMENT_NODE;
    //         return 1;
    //     }
    //
    //     get nodeName () {
    //         return this.raw.name.toUpperCase();
    //     }
    //
    //     get id () {
    //         return this.raw.attributes.id;
    //     }
    //
    //     get textContent () {
    //         // if (this.raw.children.length === 1 && this.raw.children[0].nodeType === 3) {
    //         //     return this.raw.children[0].text;
    //         // }
    //         return this.childNodes.map(node => node.textContent).join('');
    //     }
    //
    //     get outerHTML () {
    //         return ''
    //         console.warn('outerHTML');
    //         return (
    //             `<${this.tagName} ${Object.entries(this.raw.attributes).map(([key, value]) => `${key}="${value}"`).join('')}>` +
    //             this.childNodes.map(node => node.outerHTML).join('') +
    //             `</${this.tagName}>`
    //         );
    //     }
    // }
    //
    // class XMLVText extends XMLVBase {
    //     get nodeName () {
    //         return '#text';
    //     }
    //
    //     get nodeType () {
    //         // return document.TEXT_NODE;
    //         return 3;
    //     }
    //
    //     get textContent () {
    //         return this.raw.text || '';
    //     }
    //
    //     get outerHTML () {
    //         return this.raw.text || '';
    //     }
    // }

    class XMLVBase {
        constructor (childNodes) {
            this._tagName = null;
            this._attributes = null;
            this._childNodes = childNodes;
            this._children = null;
            // this.proxy = new Proxy(this, xmlvProxy);
        }

        get tagName () {
            return this._tagName;
        }

        get childNodes () {
            return this._childNodes;
        }

        get children () {
            if (this._children === null) {
                this._children = this.childNodes.filter(node => node.nodeType === 1);
            }
            return this._children;
        }

        get firstChild () {
            return this.children[0];
        }

        getAttribute (key) {
            return this._attributes !== null && this._attributes[key];
        }

        setAttribute (key, value) {
            if (this._attributes === null) {
                this._attributes = {};
            }
            return this._attributes[key] = value;
        }

        getElementsByTagName (tagName, _dest = []) {
            if (this.tagName === tagName) _dest.push(this);
            for (const child of this.children) {
                child.getElementsByTagName(tagName, _dest);
            }
            return _dest;
            // return (this.tagName === tagName ? [this] : []).concat(...this.children.map(child => child.getElementsByTagName(tagName)));
        }
    }

    class XMLVDocument extends XMLVBase {
        get nodeName () {
            return '#document';
        }

        get nodeType () {
            // return document.DOCUMENT_FRAGMENT_NODE;
            return 11;
        }
    }

    class XMLVElement extends XMLVBase {
        get nodeType () {
            // return document.ELEMENT_NODE;
            return 1;
        }

        get nodeName () {
            return this._tagName.toUpperCase();
        }

        get id () {
            return this._attributes.id;
        }

        get textContent () {
            // if (this.raw.children.length === 1 && this.raw.children[0].nodeType === 3) {
            //     return this.raw.children[0].text;
            // }
            if (this._childNodes.length === 1) {
                return this._childNodes[0].textContent;
            }
            return this.childNodes.map(node => node.textContent).join('');
        }

        get outerHTML () {
            return ''
            console.warn('outerHTML');
            return (
                `<${this.tagName} ${Object.entries(this.raw.attributes).map(([key, value]) => `${key}="${value}"`).join('')}>` +
                this.childNodes.map(node => node.outerHTML).join('') +
                `</${this.tagName}>`
            );
        }
    }

    class XMLVText extends XMLVBase {
        constructor () {
            super(null);
            this._text = '';
        }

        get nodeName () {
            return '#text';
        }

        get nodeType () {
            // return document.TEXT_NODE;
            return 3;
        }

        get textContent () {
            return this._text || '';
        }

        get outerHTML () {
            return this._text || '';
        }
    }

    const constructors = {
        document: XMLVDocument,
        element: XMLVElement,
        text: XMLVText
    };

    // const root = document.createElementNS('text/xml', 'xml');
    const root = new DOMParser().parseFromString('<xml></xml>', 'text/xml').firstChild;
    const range = document.createRange();
    range.selectNodeContents(root);

    const saxen = require('saxen');

    let saxenStack = [];

    const saxenParser = new saxen.Parser({ proxy: true });

    saxenParser.on('openTag', function (el, decodeEntities, selfClosing) {
        // if (el.attrs && el.attrs.variabletype === '&#39;&#39;') debugger;
        // const tag = {
        //     type: 'element',
        //     name: el.originalName || el.name,
        //     // attributes: Object.assign({}, el.attrs),
        //     attributes: el.attrs,
        //     children: []
        // };
        // saxenStack[saxenStack.length - 1].raw.children.push(tag);
        const node = new XMLVElement([]);
        node._tagName = el.name;
        node._attributes = el.attrs;
        for (const key in node._attributes) {
            if (node._attributes[key].indexOf('&') > -1) {
                node._attributes[key] = decodeEntities(node._attributes[key]);
            }
        }
        saxenStack[saxenStack.length - 1]._childNodes.push(node);
        saxenStack.push(node);
    });

    saxenParser.on('text', function (text) {
        // if (text === 'undefinedundefined') debugger;
        // const raw = {
        //     type: 'text',
        //     text
        // };
        // saxenStack[saxenStack.length - 1].raw.children.push(raw);
        const node = new XMLVText();
        node._text = text;
        saxenStack[saxenStack.length - 1]._childNodes.push(node);
    });

    saxenParser.on('closeTag', function (name) {
        saxenStack.pop();
    });

    // const saxenParser = new saxen.Parser();
    //
    // saxenParser.on('openTag', function (name, getAttrs, decodeEntities, selfClosing) {
    //     const tag = {
    //         type: 'element',
    //         name,
    //         attributes: getAttrs(),
    //         children: []
    //     };
    //     saxenStack[saxenStack.length - 1].children.push(tag);
    //     saxenStack.push(tag);
    // });
    //
    // saxenParser.on('text', function (text) {
    //     // if (text === 'undefinedundefined') debugger;
    //     saxenStack[saxenStack.length - 1].children.push({
    //         type: 'text',
    //         text
    //     });
    // });
    //
    // saxenParser.on('closeTag', function (name) {
    //     saxenStack.pop();
    // });

    const parseSaxen = function (text) {
        saxenStack.length = 0;
        const doc = new XMLVDocument([]);
        saxenStack.push(doc);
        saxenParser.parse(text);
        return saxenStack[0];

        // saxenStack.length = 0;
        // saxenStack.push({
        //     type: 'document',
        //     children: []
        // });
        // saxenParser.parse(text);
        // return saxenStack[0];
    };

    const domToText = ScratchBlocks.Xml.domToText;
    ScratchBlocks.Xml.domToText = function (xml) {
        if (xml instanceof Element) {
            return domToText.call(this, xml);
        }
        return xml.outerHTML;
    };

    ScratchBlocks.Xml.textToDom = function(text) {
        // console.log(parseSaxen(text));
        // console.log(parseXml(text));
        // console.log(XMLVBase.cast(parseXml(text)));
        return parseSaxen(text).firstChild;
        return XMLVBase.cast(parseSaxen(text)).firstChild;
        return XMLVBase.cast(parseXml(text)).firstChild;
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
    const svgTag = tagName => ScratchBlocks.utils.createSvgElement(tagName);
    // const svgTag = tagName => document.createElementNS(ScratchBlocks.SVG_NS, tagName);

    if (!textRoot) {
        const _textCacheWidths = {};

        const _getCachedWidth = ScratchBlocks.Field.getCachedWidth;
        ScratchBlocks.Field.getCachedWidth = function (text) {
            const _textCacheWidthsClass = _textCacheWidths[text.className.baseVal];
            if (_textCacheWidthsClass) {
                const _cached = _textCacheWidthsClass[text.textContent];
                if (_cached) {
                    return _cached;
                }
                return _textCacheWidthsClass[text.textContent] = _getCachedWidth.call(this, text);
            }
            _textCacheWidths[text.className.baseVal] = {};
            return _textCacheWidths[text.className.baseVal][text.textContent] = _getCachedWidth.call(this, text);

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

        // console.log(ScratchBlocks.ScratchMsgs.locales.en);
        // console.log(ScratchBlocks.Blocks);
        // console.log(ScratchBlocks.Msg);

        hijackTokenize(ScratchBlocks); // Regex: conclusive. Non-regex: inconclusive.
        virtualizeCreateSvgElement(ScratchBlocks);
        // hijackCreateSvgElementEventListener(ScratchBlocks, root); // Conclusive
        // hijackCreateSvgElement(ScratchBlocks); // Inconclusive
        hijackTextToDOM(ScratchBlocks); // <10%
        hijackCompareStrings(ScratchBlocks); // Scales logarithmically with number of variables
        // hijackBindEvent(ScratchBlocks);

        ScratchBlocks.Field.startCache();

        textRoot = svgTag('svg');

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
            if (!svg.cachedWidth_) {
                svg.cachedWidth_ = 100;
                svg.cachedHeight_ = 100;
                return;
            }
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

        ScratchBlocks.WorkspaceSvg.prototype.resize = function() {
            this.updateScreenCalculations_();
            if (this.toolbox_) {
                this.toolbox_.position();
            }
            if (this.flyout_) {
                this.flyout_.position();
            }
            if (this.trashcan) {
                this.trashcan.position();
            }
            if (this.zoomControls_) {
                this.zoomControls_.position();
            }
            if (this.scrollbar) {
                this.scrollbar.resize();
            }
        };

        ScratchBlocks.Toolbox.CategoryMenu.prototype.populate = function(domTree) {
            if (!domTree) {
                return;
            }

            // Remove old categories
            this.dispose();
            this.createDom();
            var categories = [];
            // Find actual categories from the DOM tree.
            for (var i = 0, child; child = domTree.childNodes[i]; i++) {
                if (!child.tagName || child.tagName.toUpperCase() != 'CATEGORY') {
                    continue;
                }
                categories.push(child);
            }

            // Create a single column of categories
            for (var i = 0; i < categories.length; i++) {
                var child = categories[i];
                // var row = goog.dom.createDom('div', 'scratchCategoryMenuRow');
                var row = document.createElement('div');
                row.className = 'scratchCategoryMenuRow';
                this.table.appendChild(row);
                if (child) {
                    this.categories_.push(new ScratchBlocks.Toolbox.Category(this, row,
                        child));
                }
            }
            this.height_ = 100;
            // this.height_ = this.table.offsetHeight;
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
            return true;

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
                var computedStyle = window.getComputedStyle(el);
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
                has3d = computedStyle.getPropertyValue(transforms[t]);
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
        if (!text) return true;
        if (textIdCache[subcache]) {
            if (textIdCache[subcache][type.class]) {
                if (textIdCache[subcache][type.class][text]) {
                    return true;
                } else {
                    textIdCache[subcache][type.class][text] = true;
                }
            } else {
                textIdCache[subcache][type.class] = {
                    [text]: true
                };
            }
        } else {
            textIdCache[subcache] = {
                [type.class]: {
                    [text]: true
                }
            };
        }
        return false;
        // const key = `${subcache}:${text}\n${type.class}`;
        // if (!textIdCache[key]) {
        //     textIdCache[key] = true;
        //     return false;
        // }
        // return true;
    };

    const add = (type, text) => {
        // if (isCached('add', type, text)) return;
        textGroup.appendChild(type(text));
    };

    const justCache = (type, text) => {
        if (!text) {
            return;
        }
        add(type, text);
    };

    const spaceRE = / /g;
    const argnumRE = /\%\d+/;
    const argcodeRE = /\%[bns]/;
    const nbsp = '\u00a0';

    const cacheOne = (type, text) => {
        if (isCached('one', type, text)) return;

        add(type, text.replace(spaceRE, nbsp));
    };

    const cacheSplit = (type, text) => {
        if (isCached('split', type, text)) return;

        for (const _sub of text.split(argnumRE)) {
            const sub = _sub.trim().replace(spaceRE, nbsp);
            add(type, sub);
        }
    };

    const cacheProccode = (type, text) => {
        if (isCached('proccode', type, text)) return;

        for (const _sub of text.split(argcodeRE)) {
            const sub = _sub.trim().replace(spaceRE, nbsp);
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

    const cacheBlockImitation = {
        id: null,
        jsonInit (def) {
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
                        cacheBlockImitation.hasDropdown = true;
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
    };

    const cacheBlock = (type, id) => {
        // if (!id) {
        //     if (textIdCache['cacheBlock:' + type]) return;
        //     textIdCache['cacheBlock:' + type] = true;
        // }
        if (textIdCache.cacheBlock) {
            if (textIdCache.cacheBlock[type]) return;
        } else {
            textIdCache.cacheBlock = {};
        }
        // if (textIdCache['cacheBlock:' + type]) return;

        cacheBlockImitation.hasDropdown = false;
        try {
            cacheBlockImitation.id = id;
            ScratchBlocks.Blocks[type].init.call(cacheBlockImitation);
        } catch (e) {
            console.log('cacheBlock', id, e);
        }
        if (!cacheBlockImitation.hasDropdown) {
            textIdCache.cacheBlock[type] = true;
            // textIdCache['cacheBlock:' + type] = true;
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
    document.body.appendChild(textRoot);

    ScratchBlocks.Field._caching = true;
    for (const element of textGroup.children) {
        ScratchBlocks.Field.getCachedWidth(element);
    }
    ScratchBlocks.Field._caching = false;


    document.body.removeChild(textRoot);
    textRoot.removeChild(textGroup);

    // console.log(textGroup);
    // console.log(dom);
    // console.log(xml);

    ScratchBlocks.utils.is3dSupported();
};

precacheTextWidths.post = function ({ScratchBlocks}) {
    hijackCreateSvgElementEventListener.post(ScratchBlocks);
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
