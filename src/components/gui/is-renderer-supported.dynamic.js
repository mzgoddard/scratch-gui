import React from 'react';
import {compose} from 'redux';
import {connect} from 'react-redux';

import {fetching, schedule} from '../../lib/dynamic-render';

const ifReadyLoad = loadModule => WrappedComponent => {
    let _loaded = null;
    return ({ready, ...props}) => {
        if (ready) {
            if (!_loaded) {
                const _module = loadModule();
                const _export = _module.default || _module;
                _loaded = _export(WrappedComponent);
            }
            return _loaded(props);
        }
        return <WrappedComponent isRendererSupported={true} {...props} />;
    };
};

export default compose(
    connect(state => ({priority: fetching(state) ? 1 : -1})),
    schedule,
    ifReadyLoad(() => require('./is-renderer-supported'))
);
