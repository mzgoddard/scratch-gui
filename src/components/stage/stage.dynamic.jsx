import {idleRequireWhileLoading} from '../../lib/dynamic-render';

export default idleRequireWhileLoading(() => require('./stage.jsx'));

// export {
//     default
// } from './stage.jsx';
