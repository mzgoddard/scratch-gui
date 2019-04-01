import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import {compose} from 'redux';

import {
    LoadingState,
    getIsFetchingWithId,
    getIsLoadingWithId
} from '../reducers/project-state';

// This is similar to VM's TaskQueue but tries to be aware of other activity,
// delaying execution, and uses a priority value, weight, instead of cost.

const pool = [];

const nextInPool = (function () {
    let _nextInPoolTimeout = null;
    let last = Date.now();
    const step = () => {
        if (pool.length && pool[0][0] === 0) {
            return;
        }
        // If it took too long for our callback to occur, JS or the browser are
        // trying to do some work. Lets wait a little more to let it run as much
        // of that work as possible.
        if (Date.now() - last > 20) {
            last = Date.now();
            return new Promise(resolve => {
                _nextInPoolTimeout = setTimeout(resolve, 5);
            })
                .then(step);
        }
    };
    return fn => {
        clearTimeout(_nextInPoolTimeout);

        last = Date.now();
        new Promise(resolve => {
            _nextInPoolTimeout = setTimeout(resolve, 5);
        })
            .then(step)
            .then(fn);
    };
}());

const removeFromPool = target => {
    const old = pool.findIndex(item => item[1] === target);
    if (old > -1) {
        pool.splice(old, 1);
    }
};

const addToPool = (weight, target, _resolve) => {
    removeFromPool(target);

    if (weight < 0) {
        _resolve();
        return;
    }

    return new Promise(resolve => {
        let i;
        for (i = pool.length - 1; i >= 0; i--) {
            if (pool[i][0] <= weight) {
                pool.splice(i + 1, 0, [weight, target, resolve]);
                break;
            }
        }
        if (i === -1) {
            pool.unshift([weight, target, resolve]);
        }
        if (pool.length === 1) {
            nextInPool(() => {
                if (pool.length > 0) {
                    pool[0][2]();
                }
            });
        }
    })
        .then(() => {
            removeFromPool(target);
            nextInPool(() => {
                if (pool.length > 0) {
                    pool[0][2]();
                }
            });
            _resolve();
        });
};

// const take1 = f => a => f(a);
// const partialRight = (f, ...b) => (...a) => f(...a, ...b);
// const partial = (f, ...a) => (...b) => f(...a, ...b)
//
// const next = () => {
//   let _nextIdleTimeout = null;
//   return (fn, ms) => {
//     clearTimeout(_nextIdleTimeout);
//     _nextIdleTimeout = setTimeout(fn, ms);
//   };
// };
//
// const timer = (() => {
//   let last = Date.now();
//   return () => {
//     const _last = last;
//     const now = last = Date.now();
//     return now - _last;
//   };
// })();
//
// const nextIdle = (timeout => test => {
//   const cont = step => {
//     timeout(() => step(step));
//   };
//   const step = test => step => {
//     if (!test()) cont(step);
//   };
//   return fn => {
//     cont(step(partial(test, fn)));
//   };
// })(take1(partialRight(next(), 5)))(fn => timer() < 20 && (fn(), true));

// Selectors here can provide a descriptive interface for when delay arguments
// should be which values. If we use only these common functions we can use that
// as a way to shortcut all of the delays gates. By replacing the functions on
// Delay with ones that return true.

const loadingState = state => state.scratchGui.projectState.loadingState;

const fetching = state => (
    loadingState(state) === LoadingState.NOT_LOADED ||
    getIsFetchingWithId(loadingState(state))
);

const isLoading = state => getIsLoadingWithId(loadingState(state));

const loadingStateVisible = state => state.scratchGui.modals.loadingProject;

const loading = state => (
    fetching(state) ||
    isLoading(state) ||
    loadingStateVisible(state)
);

// A set of extra HOCs to handle some annoying details of this interface.

const loadNull = function (load) {
    return function DelayLoadNull () {
        load();
        return null;
    };
};

const loadChildren = function DelayLoadChildren ({children}) {
    if (children) {
        children();
    }
    return null;
};

const loadComponent = function (load) {
    return function DelayLoadComponent ({children, ...props}) {
        const _Component = load();
        const Component = _Component.default || _Component;
        return <Component {...props}>{children}</Component>;
    };
};

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

const ifElse = (test, _if, _else) => ((test ? _if : _else) || null);

const modifyProps = modify => WrappedComponent => (
    function DelayModifyProps (props) {
        return collapseElement(createElement(WrappedComponent, modify(props)));
    }
);

const condition = _condition => _If => _Else => (
    function DelayCondition (props) {
        return collapseElement(
            ifElse(
                _condition(props),
                createElement(_If, props),
                createElement(_Else, props)
            )
        );
    }
);

const removeReady = modifyProps(({ready, ...props}) => props);

const conditionReady = condition(({ready}) => ready);

const ifNotReady = _Else => _If => (
    conditionReady(removeReady(_If))(removeReady(_Else))
);

const DelayNull = () => null;

class DescendantOverride extends React.Component {

}

const descendantOverride = Gate => WrappedComponent => (
    connect(state => WrappedOverride.state(state))(class WrappedOverride extends DescendantOverride {
        render () {
            return <Gate>
                <WrappedComponent />
            </Gate>;
        }
    })
);

const addOverrideToParent = function (parent, override) {

};

class PoolEntrant extends React.Component {
    constructor (props) {
        super(props);

        this.state = {ready: null};

        this.start(props);

        this.state.ready = this.state.ready || false;
    }

    componentWillReceiveProps (newProps) {
        if (this.state.ready) return;
        this.start(newProps);
    }

    componentWillUnmount () {
        if (this.state.ready) return;
        this.stop();
    }

    start ({priority}) {
        const start = Date.now();
        addToPool(priority, this, () => this.ready());
    }

    stop () {
        removeFromPool(this);
    }

    ready () {
        if (this.state.ready === false) {
            this.setState({ready: true});
        } else {
            this.state.ready = true;
        }
    }
}

const schedule = WrappedComponent => (
    class DelaySchedule extends PoolEntrant {
        render () {
            const {ready} = this.state;
            return collapseElement(createElement(WrappedComponent, {
                ready,
                ...this.props
            }));
        }
    }
);

// A HOC to delay rendering a part of the app. It keeps a boolean state and once
// true will always render the passed component and props.
//
// ready: true when we want to render
// stall: false if we want to render immediately, true if it is ok to wait
// weight:
//   - 0 if we should render on the next setTimeout callback
//   - >0 if we want the delayed renders to be render from lowest to highest

const Delay = ({ready, stall, weight, placeholder: Placeholder}) => function Delay (WrappedComponent) {

    let Delay = WrappedComponent;

    if (stall) {
        let weightState = weight;
        if (typeof weight !== 'function') {
            weightState = state => (weight || 0);
        }

        let stallState = weightState;
        if (typeof stall === 'function') {
            stallState = state => (stall(state) ? weightState(state) : -1);
        }

        Delay = compose(
            connect(state => ({
                priority: stallState(state)
            })),
            schedule,
            ifNotReady(Placeholder ? Placeholder : DelayNull)
        )(Delay);
    }

    if (typeof ready === 'function') {
        Delay = compose(
            connect(state => ({
                ready: ready(state)
            })),
            ifNotReady(Placeholder ? Placeholder : DelayNull)
        )(Delay);
    }

    return Delay;
};

Delay.loadingState = loadingState;
Delay.fetching = fetching;
Delay.isLoading = isLoading;
Delay.loadingStateVisible = loadingStateVisible;
Delay.loading = loading;

Delay.loadNull = loadNull;
Delay.loadChildren = loadChildren;
Delay.loadComponent = loadComponent;

export default Delay;

