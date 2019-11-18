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

class MoveSCU extends EventEmitter{
    constructor(option){
        super();
        if (!option) {
            throw new Error('option must apply!');
        }
        if (!option.connect || !option.dest) {
            throw new Error('option error');
        }
        this.option = option;
        this.command = createCommand(option);
    }

    moveByStudyId(sid){
        let __this = this;
        return new Promise(function(resolve,reject) {
            let spawnArgs = createCommand(__this.option);
            if (!sid) {
                return reject(new Error('Study id must apply!!!'));
            }
            updateTmpDirByPid(spawnArgs,sid);
            spawnArgs.args.push('-m');
            spawnArgs.args.push('0020000D='+sid);

            const spawnObj = spawn(spawnArgs.command, spawnArgs.args, spawnArgs.spawnOption);
            listenSpawnEvents(spawnObj,function(emitter){
                resolve(emitter);
            });
        });
    }

    moveByPatientId(pid){
        let __this = this;
        return new Promise(function(resolve,reject) {
            let spawnArgs = createCommand(__this.option);
            if (!pid) {
                return reject(new Error('Patient id must apply!!!'));
            }

            spawnArgs.args.push('-L');
            spawnArgs.args.push('PATIENT');
            spawnArgs.args.push('-M');
            spawnArgs.args.push('PatientRoot');

            spawnArgs.args.push('-m');
            spawnArgs.args.push('00100020='+pid);

            const spawnObj = spawn(spawnArgs.command, spawnArgs.args, spawnArgs.spawnOption);
            spawnObj.spawnArgs = spawnArgs;
            listenSpawnEvents(spawnObj,__this,function(emitter){
                resolve(emitter);
            });
        });
    }

    moveByStudyInstanceUId(pid){
        let __this = this;
        return new Promise(function(resolve,reject) {
            let spawnArgs = createCommand(__this.option);
            if (!pid) {
                return reject(new Error('SOPInstanceUId must apply!!!'));
            }

            spawnArgs.args.push('-m');
            spawnArgs.args.push('0020000D='+pid);

            const spawnObj = spawn(spawnArgs.command, spawnArgs.args, spawnArgs.spawnOption);
            spawnObj.spawnArgs = spawnArgs;
            listenSpawnEvents(spawnObj,__this,function(emitter){
                resolve(emitter);
            });
        });
    }

    moveBySOPInstanceUId(pid){
        let __this = this;
        return new Promise(function(resolve,reject) {
            let spawnArgs = createCommand(__this.option);
            if (!pid) {
                return reject(new Error('SOPInstanceUId must apply!!!'));
            }

            spawnArgs.args.push('-L');
            spawnArgs.args.push('PATIENT');
            spawnArgs.args.push('-M');
            spawnArgs.args.push('PatientRoot');

            spawnArgs.args.push('-m');
            spawnArgs.args.push('00080018='+pid);

            const spawnObj = spawn(spawnArgs.command, spawnArgs.args, spawnArgs.spawnOption);
            spawnObj.spawnArgs = spawnArgs;
            listenSpawnEvents(spawnObj,__this,function(emitter){
                resolve(emitter);
            });
        });
    }
}

function createCommand(option){
    let command = 'movescu.bat';
    if (os.platform().indexOf('win32') < 0) {
        command = './movescu';
    }
    const spawnOption = {
        // encoding: 'utf-8',
        cwd: config.dcm4chee.binPath
    };
    if (option.encoding) {
        spawnOption.encoding = option.encoding;
    }
    // let args = ['-c','BSCAE:10002','--directory',path.join(path.dirname(require.main.filename),'/dcmFiles/')];
    let args = [];
    if (option.connect) {
        args.push('-c');
        args.push(option.connect);
    }

    args.push('--release-timeout');
    args.push('5000');

    if (option.dest) {
        args.push('-dest');
        args.push(option.dest);
    }

    return {
        command: command,
        spawnOption: spawnOption,
        args: args
    }
}

function listenSpawnEvents(spawnObj,movescuObj,callback) {
    let emitter = new EventEmitter();
    spawnObj.status = {
        exitCode: -100,
        closeCode: -100,
        result: {
            completed: '0',
            failed: '0',
            warning: '0'
        }
    }
    let status = spawnObj.status;
    let result = spawnObj.status.result;
    var reg_completed = /\[(\d*)\]\sNumberOfCompletedSuboperations/;
    var reg_failed = /\[(\d*)\]\sNumberOfFailedSuboperations/;
    var reg_warning = /\[(\d*)\]\sNumberOfWarningSuboperations/;
    let reg_move_progress = /C-MOVE-RSP\[pcid=1, remaining=(\d*)\, completed=(\d*)\, failed=(\d*)\, warning=(\d*), status/;
    let reg_move_result = /C-MOVE-RSP\[pcid=1, completed=(\d*)\, failed=(\d*)\, warning=(\d*), status/;

    const stdoutStream = byline.createStream(spawnObj.stdout);
    stdoutStream.on('data', function(chunk) {
        let dataStr = chunk.toString();
        let progressRegResult = reg_move_progress.exec(dataStr);
        let resultRegResult = reg_move_result.exec(dataStr);

        if (progressRegResult) {
            emitter.emit('progress',{
                remaining: progressRegResult[1],
                completed: progressRegResult[2],
                failed: progressRegResult[3],
                warning: progressRegResult[4],
            });
            return;
        }
        if (resultRegResult) {
            emitter.emit('result',{
                completed: resultRegResult[1],
                failed: resultRegResult[2],
                warning: resultRegResult[3],
            });
            return;
        }

        // emitter.emit('progress',dataStr);
        
        /* let completed = reg_completed.exec(dataStr);
        let failed = reg_failed.exec(dataStr);
        let warning = reg_warning.exec(dataStr);
        if (completed) {
            result.completed = completed[1];
        }
        if (failed) {
            result.failed = failed[1];
        }
        if (warning) {
            result.warning = warning[1];
        } */
    });
    spawnObj.stderr.on('data', (err) => {

        emitter.emit('error',err);
    });
    spawnObj.on('error', function(error) {
        emitter.emit('error',error.toString());
    });
    spawnObj.on('exit', (code) => {
        status.exitCode = code;
        // onend(spawnObj,movescuObj,emitter);
    });
    spawnObj.on('close', function(code) {
        status.closeCode = code;
        // onend(spawnObj,movescuObj,emitter);
    });
    callback(emitter);
}

/**
 * 命令执行结束处理
 * @param {} spawnObj 
 * @param {*} movescuObj 
 * @param {*} emitter 
 */
function onend(spawnObj,movescuObj,emitter) {
    let status = spawnObj.status;
    
    if (status.exitCode == -100 || status.closeCode == -100) {
        return;
    }
    
    emitter.emit('result',spawnObj.status.result);
}

module.exports = MoveSCU;