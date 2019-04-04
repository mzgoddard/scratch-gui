import PropTypes from 'prop-types';
import React from 'react';

import {
    createElement,
    collapseElement
} from './gate.jsx';

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
        const item = pool.shift();
        _next();
        if (item) item[2]();
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
    if (item[1] < 0) {
        item[2]();
        return true;
    }
};

const removeFromPoolTest = (item, oldItem) => (item[0] === oldItem[0]);
const removeFromPool = (...args) => {
    _removeFromPool(removeFromPoolTest, args);
};

const addToPoolTest = (item, newItem) => (item[1] <= newItem[1]);
const addToPool = (...args) => {
    removeFromPool(...args);

    if (_callPoolNow(args)) return;

    _insertInPool(addToPoolTest, args);
    if (pool.length === 1) {
        _next();
    }
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
        addToPool(this, priority, () => this.ready());
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

PoolEntrant.propTypes = {
    priority: PropTypes.number
};

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

export {
    schedule
};
