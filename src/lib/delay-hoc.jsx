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

const timeout = () => {
    let _nextIdleTimeout = null;
    return (fn, ms) => {
        clearTimeout(_nextIdleTimeout);
        _nextIdleTimeout = setTimeout(fn, ms);
    };
};

const timer = (() => {
    let last = Date.now();
    return () => {
        const _last = last;
        const now = last = Date.now();
        return now - _last;
    };
});

const nextIdle = ((timeout, test) => (
    fn => {
        test();
        const step = () => {
            if (test()) fn();
            else timeout(step);
        };
        timeout(step);
    }
))(
    // Wait to call step for 5 milliseconds
    ((timeout, ms) => step => timeout(step, ms))(timeout(), 5),
    // Call fn if the time passed is less than 20 milliseconds
    ((timer, max) => () => timer() < max)(timer(), 20)
);

const pool = [];

const _next = (fn => (
    () => nextIdle(fn)
))(
    () => {
        if (pool.length > 0) {
            const item = pool.shift();
            _next();
            item[2]();
        }
    }
);

const _insertInPool = (test, newItem) => {
    const i = pool.findIndex(item => test(item, newItem));
    pool.splice(i + 1, 0, newItem);
}

const _removeFromPool = (test, oldItem) => {
    const i = pool.findIndex(item => test(item, oldItem));
    if (i > -1) pool.splice(i, 1);
};

const _callPoolNow = item => {
    if (item[0] < 0) {
        item[2]();
        return true;
    }
};

const removeFromPoolTest = (item, oldItem) => (item[1] === oldItem[1]);
const removeFromPool = (...args) => {
    _removeFromPool(removeFromPoolTest, args);
};

const addToPoolTest = (item, newItem) => (item[0] <= newItem[0]);
const addToPool = (...args) => {
    removeFromPool(...args);

    if (_callPoolNow(args)) return;

    _insertInPool(addToPoolTest, args);
    if (pool.length === 1) {
        _next();
    }
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

const loadNull = loadModule => (
    function DelayLoadNull () {
        loadModule();
        return null;
    }
);

const loadChildren = (
    function DelayLoadChildren ({children}) {
        if (children) {
            children();
        }
        return null;
    }
);

const loadComponent = loadModule => (
    function DelayLoadComponent ({children, ...props}) {
        const _Component = loadModule();
        const Component = _Component.default || _Component;
        return <Component {...props}>{children}</Component>;
    }
);

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
        addToPool(priority, this, () => this.ready());
    }

    stop () {
        removeFromPool(-1, this);
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

export {
    loadNull,
    loadChildren,
    loadComponent,
    ifReady,
    ifNotReady,
    DelayNull,
    gate,
    placeholder,
    addProps,
    schedule
};
