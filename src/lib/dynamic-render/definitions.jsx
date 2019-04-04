import {connect} from 'react-redux';
import {compose} from 'redux';

import {
    addProps,
    DelayNull,
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
    loadingState,
    fetching,
    isLoading,
    loadingStateVisible,
    loading,
    targetIsStage
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
    ifNotReady(DelayNull),
    loadComponent
);

export {
    fetching,
    idleRequire,
    idleRequire as idlePlaceholder,
    idleRequireWhileLoading,
    idleRequireWhileLoading as idleWhileLoading,
    idleWhileLoadingAfterFetching,
    isLoading,
    loading,
    loadingState,
    loadingStateVisible,
    whileLoading,
    whileTargetIsStage
};
