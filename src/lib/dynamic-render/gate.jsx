import React from 'react';

let createElement;
let collapseElement;

if (process.env.NODE_ENV === 'production') {
    createElement = (Type, props) => ({
        __delayElement: true,
        Type,
        props
    });

    collapseElement = element => (
        element && element.__delayElement ?
            element.Type.prototype instanceof React.Component ?
                <element.Type {...element.props} /> :
                element.Type(element.props) :
            element
    );
} else {
    createElement = (Type, props) => <Type {...props} />;

    collapseElement = element => element;
}

const ifReady = _If => _Else => (
    function DelayIfReady ({ready, ...props}) {
        if (ready) return collapseElement(createElement(_If, props));
        return collapseElement(createElement(_Else, props));
    }
);

const ifNotReady = _Else => _If => ifReady(_If)(_Else);

const DelayNull = () => null;

const gate = ifNotReady(DelayNull);

const placeholder = ifNotReady;

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
    DelayNull,
    gate,
    ifNotReady,
    ifReady,
    loadChildren,
    loadComponent,
    loadNull,
    placeholder
};
