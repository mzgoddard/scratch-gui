import {
    placeholder,
    addProps,
    schedule,
    gate,
    loadNull,
    loadComponent,
    ifNotReady,
    DelayNull
} from './delay-hoc.jsx';

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

const targetIsStage = state => (
    state.scratchGui.targets.stage &&
    state.scratchGui.targets.stage.id === state.scratchGui.targets.editingTarget
);

const placeholderWhileLoading = compose(
    placeholder,
    addProps({priority: 1}),
    schedule,
    gate,
    loadNull
);

const idleWhileLoading = loadModule => (
    compose(
        connect(state => ({priority: loading(state) ? 2 : -1})),
        schedule,
        placeholderWhileLoading(loadNull(loadModule)),
        loadComponent
    )(loadModule)
);

const idleWhileLoadingAfterFetching = compose(
    connect(state => ({ready: !fetching(state)})),
    gate,
    connect(state => ({priority: loading(state) ? 10 : -1})),
    schedule,
    gate
);

const whileLoading = compose(
    connect(state => ({ready: loading(state)})),
    ifNotReady(DelayNull)
);

const whileTargetIsStage = compose(
    connect(state => ({ready: targetIsStage(state)})),
    gate
);

export {
    loadingState,
    fetching,
    isLoading,
    loadingStateVisible,
    loading,
    idleWhileLoading,
    idleWhileLoadingAfterFetching,
    whileLoading,
    whileTargetIsStage
};
