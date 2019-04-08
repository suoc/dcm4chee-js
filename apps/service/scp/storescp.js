/**
 * SCU
 */
const path = require('path');
const {spawn}  = require('child_process');
const fs = require('fs');
const fse = require('fs-extra');
const os = require('os');
const uuid = require('uuid/v4');
const EventEmitter = require('events');
const kill = require('tree-kill');
const recursive = require("recursive-readdir");

const config = require('../../../configs/config');
const Tcp = require('../utils/tcp');


class StoreSCP extends EventEmitter{
    constructor(option){
        super();
        if (!option) {
            throw new Error('option must apply!');
        }
        if (!option.port) {
            throw new Error('option.port must be apply!');
        }
        this.option = option;
        // this.command = createCommand(option);
        this.tcpServer = new Tcp(option);
        listenTcpEvents(this);
    }

}

/**
 * SCPServer
 */
class StoreSCPServer extends EventEmitter{
    constructor(option){
        super();
        this.option = option;
        this.command = createCommand(option);
    }

    createStoreSCPServer(){
        let __this = this;
        return new Promise(async function(resolve,reject) {
            let spawnArgs = await createCommand(__this.option);

            const spawnObj = spawn(spawnArgs.command, spawnArgs.args, spawnArgs.spawnOption);
            spawnObj.spawnArgs = spawnArgs;
            listenSpawnEvents(spawnObj,__this,function(emitter){
                emitter.spawnObj = spawnObj;
                emitter.spawnArgs = spawnArgs;
                resolve(emitter);
            });
        });
    }
}
/**
 * 创建命令行参数
 * @param {*} option 
 */
async function createCommand(option){
    return new Promise(async function(resolve,reject) {
        let command = 'storescp.bat';
        if (os.platform().indexOf('win32') < 0) {
            command = './storescp';
        }
        const spawnOption = {
            // encoding: 'utf-8',
            cwd: config.dcm4chee.binPath
        };
        if (option.encoding) {
            spawnOption.encoding = option.encoding;
        }else{
            // spawnOption.encoding = "utf-8";
        }
        // let args = ['-c','BSCAE:10002','--directory',path.join(path.dirname(require.main.filename),'/dcmFiles/')];
        let args = [];
        let bind = await makeBindStr(option);
        // console.log('========bind======>',bind);
        args.push('-b');
        args.push(bind);

        if (option.tmpDir) {
            args.push('--directory');
            args.push(path.join(option.tmpDir,uuid()));
        }else{
            args.push('--directory');
            args.push(path.join(path.dirname(require.main.filename),'./tmp',uuid()));
        }

        args.push('--filepath');
        args.push('{00100020}/{0020000D}/{0020000E}/{00080018}.dcm');

        resolve({
            command: command,
            spawnOption: spawnOption,
            args: args
        });
    });
}

/**
 * 监听命令事件
 * @param {*} spawnObj 
 * @param {*} callback 
 */
function listenSpawnEvents(spawnObj,storescpObj,callback) {
    let emitter = new EventEmitter();
    spawnObj.status = {
        exitCode: -100,
        closeCode: -100
    }
    let status = spawnObj.status;

    spawnObj.stdout.on('data', function(chunk) {
        if (chunk.toString().indexOf('Start TCP Listener') >= 0) {
            emitter.emit('storescpserver_open');
        }

        emitter.emit('progress',chunk);
    });
    spawnObj.stderr.on('data', (err) => {
        emitter.emit('error',err);
    });
    spawnObj.on('error', function(error) {
        emitter.emit('error',err);
    });
    spawnObj.on('exit', (code) => {
        status.exitCode = 0;
        if (code != 0 && code) {
            status.exitCode = code;
        }
        onend(spawnObj,storescpObj,emitter);
    });
    spawnObj.on('close', function(code) {
        status.closeCode = 0;
        if (code != 0 && code) {
            status.closeCode = code;
        }
        onend(spawnObj,storescpObj,emitter);
    });
    callback(emitter);
}
/**
 * 命令执行结束处理
 * @param {} spawnObj 
 * @param {*} storescpObj 
 * @param {*} emitter 
 */
function onend(spawnObj,storescpObj,emitter) {
    let status = spawnObj.status;
    
    if (status.exitCode == -100 || status.closeCode == -100) {
        return;
    }
    
    // console.log('======indexOf===>',spawnObj.spawnArgs.args[spawnObj.spawnArgs.args.indexOf('--directory')+1]);
    let downloadDir = spawnObj.spawnArgs.args[spawnObj.spawnArgs.args.indexOf('--directory')+1];
    let result = {};
    if (status.exitCode != -100 && status.closeCode != -100) {
        recursive(downloadDir,async function (err, files) {
            if (err) {
                result.files = [];
                return emitter.emit('result',result);
            }
            result.files = files;
            if (storescpObj.option.directory) {
                await moveToDirectory(result.files,storescpObj.option.directory,function(files) {
                    result.files = files;
                    emitter.emit('result',result);
                });
                await deleteTmpDir(downloadDir);
                return;
            }

            emitter.emit('result',result);
        });
    }else{
        result.files =[];
        emitter.emit('result',result);
    }

}

/** ================================================================TCP
 * 监听tcp socket事件
 * @param {*} storeSCPObj 
 */
function listenTcpEvents(storeSCPObj) {
    let tcpServer = storeSCPObj.tcpServer;
    tcpServer.on('open',function(option) {  
        // console.log('======open=========:',option.port);
        storeSCPObj.emit('open',option.port);
    });
    tcpServer.on('connection',function(session) {  
        // console.log('======connection=========');
        storeSCPObj.emit('connection',session);
        
        let storeSCPServer = new StoreSCPServer(storeSCPObj.option);
        let scpnode;
        storeSCPServer.createStoreSCPServer().then(function(client) {
            scpnode = client;
            client.on('storescpserver_open',function() {
                let bind_index = client.spawnArgs.args.indexOf('-b')+1;
                // console.log('======before create backscp=========',client.spawnArgs.args[bind_index]);
                tcpServer.proxyTo(session,{
                    port: client.spawnArgs.args[bind_index].split(':')[1]
                });
                session.emit('storescpserver_open',client.spawnArgs.args[bind_index]);
            });
            client.on('progress',function(data) {
                session.emit('progress',data); 
            });
            client.on('error',function(error) {
                session.emit('error',error); 
            });
            client.on('result',function(result) {
               session.emit('result',result); 
            });
        });

        session.on('close',function() {
            // console.log('==========session close========');
            if (scpnode) {
                kill(scpnode.spawnObj.pid,function(err) {
                    if (err) {
                        console.error('====storescp server close error====>',err);
                        return;
                    }
                    console.log('=======kill success=====');
                });
            } 
        });
    });
}



/** ====================================================================Tools
 * 拼接 bind 字符串
 * @param {*} option 
 */
const random = require('random');
async function makeBindStr(option) {
    return new Promise(async function(resolve,reject) {
        let bind = '';
        if (option.ae) {
            bind += option.ae;
        }else{
            bind = 'STORESCP';
        }
        if (option.host) {
            bind += ('@'+option.host);
        }else{
            bind += '@127.0.0.1'
        }
        let backPorts = [30000,60000];
        if (option.backPorts) {
            backPorts = option.backPorts.split('-');
        }
        let backport = '104';
        for (let index = backPorts[0]; index <= backPorts[1]; index++) {
            backport = random.int(backPorts[0], backPorts[1]);
            try {
                await require('../utils/portIsOccupied').portIsOccupied(backport);
                break;
            } catch (error) {
                continue;
            }
        }
        bind += (':'+backport);
        resolve(bind);
    });
}
/**
 * 下载后把dcm文件移动到指定文件夹
 * @param {*} files 
 * @param {*} desDir 
 * @param {*} callback 
 */
async function moveToDirectory(files,destDir,callback) {
    let err_count = 0;
    let newFiles = [];
    for (const file of files) {
        let filePath_parts = file.split(/[/|\\]/);
        let lastPartIdx = filePath_parts.length-1;
        let destFile = path.join(destDir,filePath_parts[lastPartIdx-3],filePath_parts[lastPartIdx-2],filePath_parts[lastPartIdx-1],filePath_parts[lastPartIdx]);
        try {
            await fse.move(file,destFile,{ overwrite: true });
        } catch (error) {
            console.error(error);  
            err_count++;
        }
        newFiles.push(destFile);
    }
    if (err_count>0) {
        for (const element of newFiles) {
            if (fs.existsSync(element)) {
                try {
                    await fse.remove(element);
                } catch (error) {
                    console.error(error);                    
                }
            }
        }
        return callback([]);
    }
    return callback(newFiles);
}
/**
 * 删除缓存文件夹
 * @param {*} option 
 */
async function deleteTmpDir(tmpDir) {
    const exist = await fse.pathExists(tmpDir)
    if (exist) {
        fse.remove(tmpDir);
    }
}

module.exports = StoreSCP;

async function test(params) {
    createCommand({
        
    });
}
// test();