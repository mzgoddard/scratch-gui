import {idleWhileLoading} from '../lib/dynamic-render';

export default idleWhileLoading(() => require('./stage-wrapper.jsx'));
