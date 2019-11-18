/**
 * SCU
 */
const path = require('path');
const {spawn}  = require('child_process');
const fs = require('fs');
const fse = require('fs-extra');
const os = require('os');
const uuid = require('uuid/v4');
const byline = require('byline');

const config = require('../../../configs/config');

const EventEmitter = require('events');

class FindSCU extends EventEmitter{
    constructor(option){
        super();
        if (!option) {
            throw new Error('option must apply!');
        }
        if (!option.connect) {
            throw new Error('option.connect error');
        }
        this.option = option;
        this.command = createCommand(option);
    }

    findByStudyInstanceUId(sid){
        let __this = this;
        return new Promise(function(resolve,reject) {
            let spawnArgs = createCommand(__this.option);
            if (!sid) {
                return reject(new Error('sid error!!!'));
            }
            spawnArgs.args.push('-m');
            spawnArgs.args.push('0020000D='+sid);

            pushEndArg(spawnArgs,__this.option);

            // console.log('------>',spawnArgs.args);

            const spawnObj = spawn(spawnArgs.command, spawnArgs.args, spawnArgs.spawnOption);
            spawnObj.result = {};
            listenSpawnEvents(spawnObj,__this,function(emitter){
                resolve(emitter);
            });
        });
    }

}

function createCommand(option){
    let command = 'findscu.bat';
    if (os.platform().indexOf('win32') < 0) {
        command = './findscu';
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
    if (option.connect) {
        args.push('-c');
        args.push(option.connect);
    }

    args.push('--big-endian');

    return {
        command: command,
        spawnOption: spawnOption,
        args: args
    }
}

function pushEndArg(spawnArgs,option) {
    let queryKeysPath = '';
    if (option.queryKeysFile) {
        queryKeysPath = option.queryKeysFile;
    }else{
        queryKeysPath = path.join(path.dirname(require.main.filename),'/configs/findscu/study.xml');
    }
    spawnArgs.args.push('--');
    spawnArgs.args.push(queryKeysPath);
}

function listenSpawnEvents(spawnObj,getscuObj,callback) {
    let emitter = new EventEmitter();
    spawnObj.status = {
        exitCode: -100,
        closeCode: -100
    }
    let status = spawnObj.status;

    const stdoutStream = byline.createStream(spawnObj.stdout);
    stdoutStream.on('data', function(chunk) {
        let stdoutStr = chunk.toString();

        emitter.emit('progress',stdoutStr);

        let reg = /\((....),(....)\) (..) \[(.*)\] (.+)/;

        let reg_result = reg.exec(stdoutStr);
        if (reg_result) {
            spawnObj.result[reg_result[5]] = {
                value: reg_result[4],
                tag: reg_result[1] + reg_result[2],
                vr: reg_result[3],
            }
        }


    });
    spawnObj.stderr.on('data', (err) => {

        emitter.emit('error',err.toString());
    });
    spawnObj.on('error', function(error) {
        emitter.emit('error',err);
    });
    spawnObj.on('exit', (code) => {
        status.exitCode = 0;
        if (code != 0 && code) {
            status.exitCode = code;
        }
        onend(spawnObj,getscuObj,emitter);
    });
    spawnObj.on('close', function(code) {
        status.closeCode = 0;
        if (code != 0 && code) {
            status.closeCode = code;
        }
        onend(spawnObj,getscuObj,emitter);
    });
    callback(emitter);
}

/**
 * 命令执行结束处理
 * @param {} spawnObj 
 * @param {*} getscuObj 
 * @param {*} emitter 
 */
function onend(spawnObj,movescuObj,emitter) {
    let status = spawnObj.status;
    
    if (status.exitCode == -100 || status.closeCode == -100) {
        return;
    }
    
    emitter.emit('result',spawnObj.result);
}



module.exports = FindSCU;