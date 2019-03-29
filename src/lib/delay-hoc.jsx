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
//
// const call2 = f => a => b => f(a)(b);
//
// const step = n => f => a => n(f(a))
//
// const wrap2 = f => w => step(_a => )(w) step(_b => )(_a)) step(_b => ))(w) => step(_f => )
//
// (f, a) => f(a)
// (f, a, b) => (f)(w(a))(w(b))
//
// step()(w)(f)
//
// (f(w(a)))(w(b))
// g = f(w(a))
// h = g(w(b))
// h = (f(w(a)))(w(b))
// h(w) = (f(w(a)))(w(b))
//
// f => w => a => b =>
// e = w => n => a => n(w(a))
//
// b => n(a)(b)
// a => e(w)(b => n(a)(b))
// e(w)(a => e(w)(b => n(a)(b)))
// d => d(a => d(b => n(a)(b)))
// nest2 = n => d => a => b => d(n)
// e = w => f => a => f(w(a))
//
//
//
//
// wrap1 = w => f => a => f(w(a))
// wrap2 = w => f => wrap1(w)(wrap1(w)(f))
// compose2 = c => f => c(c(f))
// compose2(wrap1(w))(f)
//
//
//
// f(w(a))(w(b))
// c2(w(_w))(f)
// w1(w1(f))
//
//
//
// wrap2 = w => f => call2(wrap1(w)(f))
// // call2(wrap1(w))
//
// w => f => wrap1(w)(wrap1(w)(f))
// w => f => (w1 = wrap1(w), w1(w1(f)))
//
// compose(w1, w1, f)
// wrap = w => f => compose(w1, w1)(f)
//
// e(w)
//
// call1 = f => a => f(a)
// call2 = f => call1(call1(f))
// call3 = f => call1(call2(f))
//
// g = f => w => a => f(w(a))
// h = g => w => b => g(w(b))
//
// h = ( f (w(a)) )(w(b))
//
// w => f => x =>
// w => f => y =>
//
// a =>
// w => b => w(b)
//
// f => a => b => f(a)(b)
// f => w => a => call2(f(w(a))
// g => w => b =>
//
// a
// w(a)
// g = f(w(a))
// h = g(w(b))
// _ = w => f => x => f(w(a))
// _w = w => f => _(w)(wa => _(w)(f(wa)))
// _(w)(f(wa))
// _(w)(wa => _(w)(f(wa)))
//
// g = w => f => a => f(w(a))
// h = w => g => b => g(w(b))
// _ = w => f => a => h(w)(g(w)(f)(?))(?)
// _ = w => g(w)(f)(a)
//
// a => b => c => a(b(c))
// a => b => c => a(b(c))
// a => b => c => a(b(c))
//
// f(w)(a)(b)
// wrap1(wrap1(f)(w)(a))(w)(b)

const wrap2 = f => w => a => b => f(w(a))(w(b))

const flip2 = f => a => b => f(b)(a);

const conditionReady = wrap2(condition(({ready}) => ready), removeReady);

const conditionNotReady = flip2(conditionReady);

const ifNotReady = _Else => _If => (
    condition(({ready}) => ready)(removeReady(_If))(removeReady(_Else))
    // conditionReady(_If)(_Else)
);

const DelayNull = () => null;

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

