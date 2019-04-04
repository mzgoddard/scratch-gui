import React from 'react';

class AfterReady extends React.Component {
    constructor (props) {
        super(props);

        this.state = {ready: props.ready ? true : false};
    }

    componentWillReceiveProps (newProps) {
        if (this.state.ready === false && newProps.ready) {
            this.setState({ready: true});
        }
    }

    render () {
        const {ready} = this.state;
        const {
            Component,
            ...inputProps
        } = this.props;
        const outputProps = {...inputProps, ready};
        return <Component {...outputProps} />;
    }
}

const afterReady = WrappedComponent => (
    function AfterReadyWrapped (props) {
        return <AfterReady Component={WrappedComponent} {...props} />;
    }
);

export {
    afterReady
};
