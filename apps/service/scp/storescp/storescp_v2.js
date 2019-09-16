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
const moment = require('moment');
const findFreePort = require('find-free-port');
const random = require('random');
const byline = require('byline');

const config = require('../../../../configs/config');
const Tcp = require('../../utils/tcp');

const storescpFSService = require('./services/storescpFSService');

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
        // this.command = createCommand(option);
        this.result = {
            files: []
        };
    }

    createStoreSCPServer(){
        let __this = this;
        return new Promise(function(resolve,reject) {

            createCommand(__this.option).then(function(spawnArgs) {
                const spawnObj = spawn(spawnArgs.command, spawnArgs.args, spawnArgs.spawnOption);
                spawnObj.spawnArgs = spawnArgs;
                listenSpawnEvents(spawnObj,__this,function(emitter){
                    emitter.spawnObj = spawnObj;
                    emitter.spawnArgs = spawnArgs;
                    resolve(emitter);
                });
            }).catch(function(error) {
                reject(error);
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
        let spawnOption = {
            // encoding: 'utf-8',
            cwd: config.dcm4chee.binPath
        };

        let command = 'storescp.bat';
        if (os.platform().indexOf('win32') < 0) {
            command = './storescp';
        }
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

        if (option.directory) {
            args.push('--directory');
            let time = moment();
            let directory = path.join(
                                    option.directory
                                    ,uuid()
                                    ,time.format('YYYY')
                                    ,time.format('MM')
                                    ,time.format('DD'));
            args.push(directory);
        }else{
            throw new Error('Error: option.directory is null !');
        }

        args.push('--filepath');
        // args.push('{00100020}/{0020000D}/{0020000E}/{00080018}.dcm');
        args.push('{00080018}.dcm');

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

    const stdoutStream = byline.createStream(spawnObj.stdout);
    stdoutStream.on('data', function(chunk) {
        let stdoutStr = chunk.toString();
        // console.log('======>',stdoutStr);
        
        if (stdoutStr.indexOf('enter state: Sta1 - Idle') != -1) {
            setTimeout(function(){
                if (spawnObj.pid) {
                    onend(spawnObj,storescpObj,emitter);
                    
                    // 杀死进程
                    kill(spawnObj.pid,function(err) {
                        if (err) {
                            console.error('STORESCP','====storescp server close error====>',err);
                            return;
                        }
                        console.log('STORESCP','=======kill success=====');
                    });
                } 
            },2000);
        }
        if (stdoutStr.indexOf('Start TCP Listener') >= 0) {
            emitter.emit('storescpserver_open');

            // 监听dcm存储文件夹
            let downloadDir = spawnObj.spawnArgs.args[spawnObj.spawnArgs.args.indexOf('--directory')+1];
            fse.ensureDir(downloadDir);
            storescpObj.watcher = storescpFSService.watch(downloadDir,emitter,storescpObj);
            return;
        }

        emitter.emit('progress',chunk.toString());
    });
    // 命令报错事件 监听
    const stderrStream = byline.createStream(spawnObj.stderr);
    stderrStream.on('data', (chunk) => {
        emitter.emit('error',chunk.toString());
        setTimeout(function(){
            if (spawnObj.pid) {
                onend(spawnObj,storescpObj,emitter);
                
                // 杀死进程
                kill(spawnObj.pid,function(err) {
                    if (err) {
                        console.error('STORESCP','====storescp server close error====>',err);
                        return;
                    }
                    console.log('STORESCP','=======kill success=====');
                });
            } 
        },2000);
    });
    spawnObj.on('error', function(error) {
        emitter.emit('error',error);
    });
    spawnObj.on('exit', (code) => {
        status.exitCode = 0;
        if (code != 0 && code) {
            status.exitCode = code;
        }
        // onend(spawnObj,storescpObj,emitter);
    });
    spawnObj.on('close', function(code) {
        status.closeCode = 0;
        if (code != 0 && code) {
            status.closeCode = code;
        }
        // onend(spawnObj,storescpObj,emitter);
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
    if (storescpObj.watcher) {
        storescpObj.watcher.close();
    }
    emitter.emit('result',storescpObj.result);

}

/** ================================================================TCP
 * 监听tcp socket事件
 * @param {*} storeSCP_TCP_Obj 
 */
function listenTcpEvents(storeSCP_TCP_Obj) {
    let tcpServer = storeSCP_TCP_Obj.tcpServer;
    tcpServer.on('open',function(option) {  
        // console.log('======open=========:',option.port);
        storeSCP_TCP_Obj.emit('open',option.port);
    });
    tcpServer.on('connection',function(session) {  
        // console.log('======connection=========');
        storeSCP_TCP_Obj.emit('connection',session);
        
        let storeSCPServer = new StoreSCPServer(storeSCP_TCP_Obj.option);
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
            client.on('file',function(filePath) {
                session.emit('file',filePath); 
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
            /* setTimeout(function(){
                if (scpnode) {
                    kill(scpnode.spawnObj.pid,function(err) {
                        if (err) {
                            console.error('STORESCP','====storescp server close error====>',err);
                            return;
                        }
                        console.log('STORESCP','=======kill success=====');
                    });
                } 
            },30000); */
        });
    });
}



/** ====================================================================Tools
 * 拼接 bind 字符串
 * @param {*} option 
 */
async function makeBindStr(option) {
    return new Promise(function(resolve,reject) {
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
        
        // 获取空闲端口
        let minPort = random.int(backPorts[0],backPorts[1]);
        findFreePort(minPort,backPorts[1],function(err,backport) {
            if (err) {
                return reject(err);
            }
            // console.log('============================================',backport);
            bind += (':'+backport);
            resolve(bind);
        });
    });
}

module.exports = StoreSCP;