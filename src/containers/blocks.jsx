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

const hijackCreateSvgElement = ScratchBlocks => {
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
            templates[id] = document.createElementNS(ScratchBlocks.SVG_NS, name);
            templates[id].keys = [];
            for (var key in attrs) {
                const attr = document.createAttribute(key);
                attr.value = attrs[key];
                templates[id].attributes.setNamedItem(attr);
                templates[id].keys.push([key.toLowerCase(), key]);
            }
            console.log(id, templates[id].keys, attrs);
        }
        const t = templates[id];
        var e = t.cloneNode();
        const keys = t.keys;
        for (var i = 0; i < keys.length; i++) {
            e.attributes[i].value = attrs[keys[i][1]];
        }
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
        console.log(dom.firstChild);
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

let textRoot;
let textIdCache = {};
const precacheTextWidths = ({ScratchBlocks, xml}) => {
    const svgTag = type => document.createElementNS("http://www.w3.org/2000/svg", type);

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
        //     console.log('CategoryMenu.getHeight');
        //     return getHeight.call(this);
        // };

        textRoot = svgTag('svg');
        document.body.appendChild(textRoot);
        console.log(ScratchBlocks.ScratchMsgs.locales.en);
        console.log(ScratchBlocks.Blocks);
        console.log(ScratchBlocks.Msg);

        // hijackTokenize(ScratchBlocks);
        // hijackCreateSvgElement(ScratchBlocks);
        // hijackTextToDOM(ScratchBlocks);
        hijackCompareStrings(ScratchBlocks);

        ScratchBlocks.Field.startCache();

        // const DataCategory = ScratchBlocks.DataCategory;
        // ScratchBlocks.DataCategory = function (...args) {
        //     const result = DataCategory.call(this, ...args);
        //     console.log(result);
        //     return result;
        // };
        // Object.assign(ScratchBlocks.DataCategory, DataCategory);

    }

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

    const dom = new DOMParser().parseFromString(xml, 'application/xml');

    const textGroup = svgTag('g');

    const add = (type, text) => {
        const key = text + '\n' + type.class;
        if (!textIdCache[key]) {
            textIdCache[key] = true;
            textGroup.appendChild(type(text));
        }
    };

    const justCache = (type, text) => {
        if (!text) {
            return;
        }
        add(type, text);
    };

    const cacheOne = (type, text) => {
        if (!text) {
            return;
        }
        add(type, text.replace(/ /g, '\u00a0'));
    };

    const cacheSplit = (type, text) => {
        if (!text) {
            return;
        }
        for (const _sub of text.split(/\%\d+/)) {
            const sub = _sub.trim().replace(/ /g, '\u00a0');
            add(type, sub);
        }
    };

    const cacheProccode = (type, text) => {
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
        if (!id) {
            if (textIdCache['cacheBlock:' + type]) return;
            textIdCache['cacheBlock:' + type] = true;
        }

        try {
        ScratchBlocks.Blocks[type].init.call({
            id,
            jsonInit(def) {
                // console.log(type, id, def);

                if (def.message0) {
                    cacheSplit(blocklyText, def.message0);
                }
                if (def.message1) {
                    cacheSplit(blocklyText, def.message1);
                }
                if (def.message2) {
                    cacheSplit(blocklyText, def.message2);
                }
                if (def.message3) {
                    cacheSplit(blocklyText, def.message3);
                }
                if (def.args0) {
                    for (const arg of def.args0) {
                        if (arg.variable) {
                            cacheOne(blocklyDropdownText, arg.variable);
                        }
                        if (arg.type === 'field_dropdown') {
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
    };

    cacheOne(blocklyText, ' ');
    cacheOne(blocklyDropdownText, ' ');
    justCache(blocklyText, ScratchBlocks.Msg.NEW_VARIABLE);
    justCache(blocklyText, ScratchBlocks.Msg.NEW_LIST);
    justCache(blocklyText, ScratchBlocks.Msg.NEW_PROCEDURE);

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

            if (el.getAttribute('type') === '') {
                cacheBlock('data_setvariableto');
                cacheBlock('data_changevariableby');
                cacheBlock('data_showvariable');
                cacheBlock('data_hidevariable');
            } else if (el.getAttribute('type') === 'list') {
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
            }
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

    Array.from(dom.children).forEach(sweep);

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

    console.log(textGroup);
    console.log(dom);
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

        precacheTextWidths({ScratchBlocks: this.ScratchBlocks, xml: this.props.toolboxXML});

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
