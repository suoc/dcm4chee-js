/**
 * app
 */
const path = require('path');
const os = require('os');

require('./apps/service/scp/dcmqrscp');
// require('./apps/service/scp/storescp');
// require('./apps/service/scp/storescpService');

// require('./test/getscu_test');


// console.log(os.platform());
// require('./test/test_tcp2');
// require('./test/test_tcp');

/**
 * fse 测试
 */
// require('./test/test_fse');
require('./test');