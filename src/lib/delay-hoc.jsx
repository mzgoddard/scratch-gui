import React from 'react';
import {connect} from 'react-redux';
import {compose} from 'redux';

import {
    addProps,
    DelayNull,
    fetching,
    gate,
    ifNotReady,
    isLoading,
    loadChildren,
    loadComponent,
    loading,
    loadingState,
    loadingStateVisible,
    loadNull,
    placeholder,
    schedule
} from './dynamic-render';

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
