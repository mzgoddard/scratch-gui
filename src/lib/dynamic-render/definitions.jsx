import {connect} from 'react-redux';
import {compose} from 'redux';

import {
    addProps,
    Null,
    gate,
    ifNotReady,
    placeholder
} from './gate.jsx';

import {
    loadComponent,
    loadNull
} from './load-module.jsx';

import {
    schedule
} from './schedule.jsx';

import {
    fetching,
    loading
} from './selectors';

const idleRequire = compose(
    placeholder,
    addProps({priority: 1}),
    schedule,
    gate,
    loadNull
);

const idleWhileLoadingWithPriority = priority => (
    compose(
        connect(state => ({priority: loading(state) ? priority : -1})),
        schedule
    )
);

const idleWhileLoading = compose(
    idleWhileLoadingWithPriority(2),
    gate,
    loadComponent
);

const idleRequireWhileLoading = loadModule => (
    compose(
        idleWhileLoadingWithPriority(2),
        idleRequire(loadModule),
        loadComponent
    )(loadModule)
);

const afterFetching = compose(
    connect(state => ({ready: !fetching(state)})),
    gate
);

const idleWhileLoadingAfterFetching = compose(
    afterFetching,
    idleWhileLoadingWithPriority(10),
    gate,
    loadComponent
);

const whileLoading = compose(
    connect(state => ({ready: loading(state)})),
    ifNotReady(Null),
    loadComponent
);

export {
    idleWhileLoading,
    idleRequireWhileLoading,
    idleWhileLoadingAfterFetching,
    whileLoading
};
