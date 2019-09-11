/**
 * SPC 目录 service
 */
const chokidar = require('chokidar');

class storescpFSService {

    constructor(){

    }

    static watch(path,emmiter,storescpObj) {
        const watcher = chokidar.watch(path, {
            ignored: '**.part',
            persistent: true
        });
        
        watcher.on('add', function(path) {
            // console.log('[',path,'===',arg1,'===',arg2,']');
            storescpObj.result.files.push(path);

            emmiter.emit('file',path);
        });
        
        return watcher;
    }

}

module.exports = storescpFSService;