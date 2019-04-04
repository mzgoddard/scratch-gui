import {idleWhileLoading} from '../lib/dynamic-render';

export default idleWhileLoading(() => require('./target-pane.jsx'));
