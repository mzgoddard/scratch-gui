import React from 'react';

let createElement;
let collapseElement;

if (true || process.env.NODE_ENV === 'production') {
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

const flattenStatelessElement = (Type, props) => (
    collapseElement(createElement(Type, props))
);

export {
    collapseElement,
    createElement,
    flattenStatelessElement
};
