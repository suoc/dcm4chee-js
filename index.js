/**
 * 
 */
const path = require('path');
const os = require('os');
const fs = require('fs');

const config = require('./configs/config');

const GetSCU = require('./apps/service/scu/getscu');
const StoreSCP = require('./apps/service/scp/storescp');
const StoreSCP_V2 = require('./apps/service/scp/storescp/storescp_v2');
const MoveSCU = require('./apps/service/scu/movescu');
const FindSCU = require('./apps/service/scu/findscu');

function init(){
    if (os.platform().indexOf('win32') < 0) {
        // console.log(path.join(config.dcm4chee.binPath,'*'));
        let storescp_binPath = path.join(config.dcm4chee.binPath,'storescp');
        let storescu_binPath = path.join(config.dcm4chee.binPath,'storescu');
        let movescu_binPath = path.join(config.dcm4chee.binPath,'movescu');
        fs.chmod(storescp_binPath,0777,function(err,err2) {
            if (err) throw err;
        });
        fs.chmod(storescu_binPath,0777,function(err,err2) {
            if (err) throw err;
        })
        fs.chmod(movescu_binPath,0777,function(err,err2) {
            if (err) throw err;
        })
    }
}

init();

module.exports = {
    GetSCU: GetSCU,
    StoreSCP: StoreSCP,
    StoreSCP_v2: StoreSCP_V2,
    MoveSCU: MoveSCU,
    FindSCU: FindSCU
}