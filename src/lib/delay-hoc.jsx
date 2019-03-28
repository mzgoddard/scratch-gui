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
    if (weight < 0) {
        _resolve();
        return;
    }

    return new Promise(resolve => {
        removeFromPool();

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
    return function () {
        load();
        return null;
    };
};

const loadChildren = function ({children}) {
    if (children) {
        children();
    }
    return null;
};

const loadComponent = function (load) {
    return function ({children, ...props}) {
        const _Component = load();
        const Component = _Component.default || _Component;
        return <Component {...props}>{children}</Component>;
    };
};

class Signal {
    constructor (ready = false) {
        this.ready = ready;
        this._then = [];
    }

    then (resolve, reject) {
        if (this._then !== null) {
            return new Promise((_resolve, _reject) => this._then.push(() => {
                try {
                    resolve();
                    _resolve();
                } catch (e) {
                    reject(e);
                    _reject(e);
                }
            }));
        } else {
            return new Promise(_resolve => {
                resolve();
                _resolve();
            }).then(null, reject);
        }
    }

    resolve () {
        if (this.ready) return;
        this.ready = true;
        this._then.forEach(then => then());
        this._then = null;
    }
}

const ifElse = (test, _if, _else) => (test ? _if : _else = null);

const _ChildrenReady = ({ready, children}) => ifElse(ready, children);

const _elseIfReady = _Else => _If => (
    ({ready, children, ...props}) => ifElse(
        ready, <_If {...props}>{children}</_If>, <_Else {...props} />
    )
);

const _Null = () => null;

const RawGate = _elseIfReady(_Null);

const ReadySignal = ({signal}) => {
    signal.resolve();
    return null;
};

class _ReadySet extends React.Component{
    constructor (props, args) {
        super(props);

        this.state = {ready: null};
        this.args = args;
    }

    componentWillUnmount () {
        this.stop();
    }

    start () {}

    stop () {
        this.state.ready = null;
    }

    ready () {
        if (this.state.ready === false) {
            this.setState({ready: true});
        } else {
            this.state.ready = true;
        }
    }
}

class _ReadyPortal extends _ReadySet {
    constructor (props, signal = props.signal || new Signal()) {
        super(props, {signal: signal});

        this.start(props, this.args);

        if (!this.state.ready === null) {
            this.state.ready = false;
        }
    }

    componentDidUpdate () {
        this.start(this.props, this.args);
    }

    start (_, {signal}) {
        signal.then(() => this.ready());
    }
}

const _Portal = WrappedComponent => (
    class _Portal extends _ReadyPortal {
        constructor (props) {
            super(props);
        }

        render () {
            const {signal, children, ...props} = this.props;
            const {ready} = this.state;
            return (<WrappedComponent signal={this.args.signal} ready={ready} {...props}>
                {children}
            </WrappedComponent>);
        }
    }
);

const Portal = _Portal(_ChildrenReady);

const wrapRemove = remover => WrappedComponent => (
    ({children, ...props}) => (
        <WrappedComponent {...remover(props)}>{children}</WrappedComponent>
    )
);

const removeSignalProp = wrapRemove(({signal, ...props}) => props);

const ReadyGate = Action => Lock => WrappedComponent => (
    ({ready, children, ...props}) => (
        <React.Fragment>
            {ifElse(ready, null, <Lock {...props}><Action {...props} /></Lock>)}
            <WrappedComponent {...props}>{children}</WrappedComponent>
        </React.Fragment>
    )
);

const SignalGate = Lock => WrappedComponent => (
    _Portal(
        ReadyGate(
            ReadySignal
        )(
            removeSignalProp(Lock)
        )(
            _Portal(removeSignalProp(WrappedComponent))
        )
    )
);

class _ReadyPoolEntrant extends _ReadySet {
    constructor (props, args) {
        super(props, args);

        this.start(props, args);

        if (!this.state.ready === null) {
            this.state.ready = false;
        }
    }

    componentWillReceiveProps (newProps) {
        this.start(newProps, this.args);
    }
}

class PoolEntrant extends _ReadyPoolEntrant {
    start ({priority}) {
        addToPool(priority, this, () => this.ready());
    }

    stop () {
        removeFromPool(this);
    }

    render () {
        return this.state.ready ? this.props.children : null;
    }
}

const _Schedule = ({priority, children}) => (
    <PoolEntrant priority={priority}>{children}</PoolEntrant>
);

const Schedule = WrappedComponent => (
    ({priority, children, ...props}) => (
        <_Schedule priority={priority}>
            <WrappedComponent ready {...props}>{children}</WrappedComponent>
        </_Schedule>
    )
);

// const Schedule = WrappedComponent => (
//     SignalGate(_Schedule)(WrappedComponent)
// );

const Placeholder = _elseIfReady;

// const Placeholder = _Else => _If => _elseIfReady(
//     _Else
// )(
//     ({children, ...props}) => <_If ready {...props}>{children}</_If>
// );

const Gate = Lock => WrappedComponent => (
    SignalGate(Lock)(RawGate(WrappedComponent))
);

const Delay = ({ready, stall, weight, placeholder: _placeholder}) => (WrappedComponent) => {

    // return WrappedComponent;
    let Delay = WrappedComponent;

    // let Delay = WrappedComponent => WrappedComponent;
    if (stall) {
        // if (_placeholder) {
        //     Delay = Placeholder(_placeholder)(({children}) => children);
        // }

        let weightState = weight;
        if (typeof weight !== 'function') {
            weightState = state => weight || 0;
        }

        let stallState = weightState;
        if (typeof stall === 'function') {
            stallState = state => stall(state) ? weightState(state) : -1;
        }

        Delay = compose(
            connect(state => (console.log('priority', stallState(state)), {
                // ready: true,
                priority: stallState(state)
            })),
            Schedule,
            (_placeholder ? Placeholder(_placeholder) : RawGate)
        )(Delay);
        // Delay = Gate(compose(
        //     connect(state => ({
        //         priority: stallState(state)
        //     })),
        //     Schedule
        // )(Delay));
    }

    // return Delay;

    if (typeof ready === 'function') {
        // if (_placeholder) {
        //     Delay = Placeholder(_placeholder);
        // }

        // return compose(
        //     connect(state => ({
        //         ready: ready(state)
        //     })),
        //     RawGate
        // )(WrappedComponent);
        // return Gate(compose(
        //     connect(state => ({
        //         ready: ready(state)
        //     }))
        // )(WrappedComponent => WrappedComponent));

        Delay = compose(
            connect(state => (console.log('ready', ready(state)), {
                ready: ready(state)
            })),
            (_placeholder ? Placeholder(_placeholder) : RawGate)
        )(Delay);
        // Delay = Gate(compose(
        //     connect(state => ({
        //         ready: ready(state)
        //     }))
        // )(Delay));
    }

    // return WrappedComponent;

    return Delay;
};

// const Example = compose(
//     Gate(
//         compose(
//             Gate(
//                 compose(
//                     connect(state => ({ready: ...})),
//                     Placeholder(() => <Loading />)
//                 )
//             ),
//             connect(state => ({priority: ...})),
//             Schedule,
//             Placeholder(() => <Loading />)
//         )
//     ),
//     GateOnce(
//         compose(
//             GateOnce(state => ({priority: ...}),
//                 compose(
//                     Placeholder(() => <Loading />),
//                     GateOnceEnd
//                 )
//             ),
//             connect(state => ({priority: ...})),
//             Schedule,
//             Placeholder(() => <Loading />),
//             GateOnceEnd
//         )
//     ),
//     Load(() => require('./some-component.jsx'))
// );

// A HOC to delay rendering a part of the app. It keeps a boolean state and once
// true will always render the passed component and props.
//
// ready: true when we want to render
// stall: false if we want to render immediately, true if it is ok to wait
// weight:
//   - 0 if we should render on the next setTimeout callback
//   - >0 if we want the delayed renders to be render from lowest to highest

// const Delay = ({ready, stall, weight, placeholder: _placeholder}) => (WrappedComponent) => {
//     const _ready = typeof ready !== 'function' ? ready : false;
//     const _stall = typeof stall !== 'function' ? stall : false;
//     const _weight = typeof weight !== 'function' ? weight : 0;
//
//     class Delay extends React.Component {
//         constructor (props) {
//             super(props);
//
//             this.state = {
//                 shouldRender: null
//             };
//
//             this.operate(this.props);
//
//             if (!this.state.shouldRender) {
//                 this.state.shouldRender = false;
//             }
//         }
//
//         componentWillUnmount () {
//             removeFromPool(this);
//             this.state.shouldRender = true;
//         }
//
//         componentWillReceiveProps (newProps) {
//             this.operate(newProps);
//         }
//
//         shouldComponentUpdate (newProps, newState) {
//             if (this.state.shouldRender !== newState.shouldRender) {
//                 return true;
//             }
//             const {
//                 ready,
//                 stall,
//                 weight,
//                 placeholder,
//                 ...nonHocProps
//             } = newProps;
//             for (const key in nonHocProps) {
//                 if (nonHocProps[key] !== this.props[key]) {
//                     return true;
//                 }
//             }
//             return false;
//         }
//
//         operate (newProps) {
//             const {ready = _ready} = newProps;
//             if (!this.state.shouldRender && ready) {
//                 const {stall = _stall, weight = _weight} = newProps;
//
//                 if (stall) {
//                     addToPool(weight, this)
//                         .then(() => {
//                             if (!this.state.shouldRender) {
//                                 this.setState({
//                                     shouldRender: true
//                                 });
//                             }
//                         });
//                     return;
//                 }
//
//                 removeFromPool(this);
//
//                 if (this.state.shouldRender === false) {
//                     this.setState({
//                         shouldRender: true
//                     });
//                 } else {
//                     this.state.shouldRender = true;
//                 }
//             }
//         }
//
//         render () {
//             if (this.state.shouldRender) {
//                 const {
//                     ready,
//                     stall,
//                     weight,
//                     placeholder,
//                     children,
//                     ...componentProps
//                 } = this.props;
//                 return (<WrappedComponent {...componentProps}>
//                     {children}
//                 </WrappedComponent>);
//             }
//
//             const {placeholder = _placeholder} = this.props;
//             return placeholder ? placeholder(this.props) : null;
//         }
//     }
//
//     Delay.propTypes = {
//         placeholder: PropTypes.func,
//         ready: PropTypes.bool,
//         stall: PropTypes.bool,
//         weight: PropTypes.number
//     };
//
//     if (typeof ready === 'function' || typeof stall === 'function' || typeof weight === 'function') {
//         const mapStateToProps = (state, props) => {
//             const result = {};
//             if (typeof ready === 'function') {
//                 result.ready = ready(state, props);
//             }
//             if (typeof stall === 'function') {
//                 result.stall = stall(state, props);
//             }
//             if (typeof weight === 'function') {
//                 result.weight = weight(state, props);
//             }
//             return result;
//         };
//         return connect(mapStateToProps)(Delay);
//     }
//     return Delay;
// };

Delay.loadingState = loadingState;
Delay.fetching = fetching;
Delay.isLoading = isLoading;
Delay.loadingStateVisible = loadingStateVisible;
Delay.loading = loading;

Delay.loadNull = loadNull;
Delay.loadChildren = loadChildren;
Delay.loadComponent = loadComponent;

export default Delay;

