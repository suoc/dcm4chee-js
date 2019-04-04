/**
 * 
 */
const GetSCU = require('./apps/service/scu/getscu');
const StoreSCP = require('./apps/service/scp/storescp');
const MoveSCU = require('./apps/service/scu/movescu');

module.exports = {
    GetSCU: GetSCU,
    StoreSCP: StoreSCP,
    MoveSCU: MoveSCU
}