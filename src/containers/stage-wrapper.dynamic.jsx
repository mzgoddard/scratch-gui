import {idleRequireWhileLoading} from '../lib/dynamic-render';

export default idleRequireWhileLoading(() => require('./stage-wrapper.jsx'));

// export {
//     default
// } from './stage-wrapper.jsx';
