import {whileLoading} from '../../lib/dynamic-render';

export default whileLoading(() => require('./loader.jsx'));
