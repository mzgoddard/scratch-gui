import React from 'react';
import {compose} from 'redux';

import {afterReady} from './after-ready.jsx';
import {createElement, collapseElement} from './element.jsx';

const ifReady = _If => _Else => (
    function DelayIfReady ({ready, ...props}) {
        if (ready) return collapseElement(createElement(_If, props));
        return collapseElement(createElement(_Else, props));
    }
);

const ifNotReady = _Else => _If => ifReady(_If)(_Else);

const Null = () => null;

const gate = compose(
    afterReady,
    ifNotReady(Null)
);

const placeholder = _Else => compose(
    afterReady,
    ifNotReady(_Else)
);

const addProps = moreProps => WrappedComponent => (
    function DelayAddProps (props) {
        const _props = {...props, ...moreProps};
        return collapseElement(createElement(WrappedComponent, _props));
    }
);

export {
    addProps,
    collapseElement,
    createElement,
    Null,
    gate,
    ifNotReady,
    ifReady,
    loadChildren,
    loadComponent,
    loadNull,
    placeholder
};
