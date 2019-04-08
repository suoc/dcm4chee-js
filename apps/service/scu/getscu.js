/**
 * SCU
 */
const path = require('path');
const {spawn}  = require('child_process');
const fs = require('fs');
const fse = require('fs-extra');
const os = require('os');
const uuid = require('uuid/v4');

const config = require('../../../configs/config');

const EventEmitter = require('events');

class GetSCU extends EventEmitter{
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

    getDcmFilesByStudyId(sid){
        let __this = this;
        return new Promise(function(resolve,reject) {
            let spawnArgs = createCommand(__this.option);
            if (!sid) {
                return reject(new Error('sid error!!!'));
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

    getDcmFilesByPatientId(pid){
        let __this = this;
        return new Promise(function(resolve,reject) {
            let spawnArgs = createCommand(__this.option);
            if (!pid) {
                return reject(new Error('pid error!!!'));
            }

            updateTmpDirByPid(spawnArgs,pid);

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
}

function createCommand(option){
    let command = 'getscu.bat';
    if (os.platform().indexOf('win32') < 0) {
        command = './getscu';
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
    if (option.tmpDir) {
        args.push('--directory');
        args.push(path.join(option.tmpDir));
    }else{
        args.push('--directory');
        args.push(path.join(path.dirname(require.main.filename),'./tmp'));
    }

    return {
        command: command,
        spawnOption: spawnOption,
        args: args
    }
}

function listenSpawnEvents(spawnObj,getscuObj,callback) {
    let emitter = new EventEmitter();
    spawnObj.status = {
        exitCode: -100,
        closeCode: -100
    }
    let status = spawnObj.status;

    spawnObj.stdout.on('data', function(chunk) {
        // console.log('================> stdout =>');
        // console.log(chunk.toString());

        emitter.emit('progress',chunk);

        /* fs.writeFile(path.join(path.dirname(require.main.filename),'log.txt'),'================> stdout =>\r\n'+chunk.toString(),{flag: 'a'},function(params) {
            
        }); */
    });
    spawnObj.stderr.on('data', (err) => {
        // console.log('================> stderr =>');
        // console.log(data.toString());

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
function onend(spawnObj,getscuObj,emitter) {
    let status = spawnObj.status;
    
    if (status.exitCode == -100 || status.closeCode == -100) {
        return;
    }
    
    // console.log('======indexOf===>',spawnObj.spawnArgs.args[spawnObj.spawnArgs.args.indexOf('--directory')+1]);
    let downloadDir = spawnObj.spawnArgs.args[spawnObj.spawnArgs.args.indexOf('--directory')+1];
    let result = {};
    if (status.exitCode == 0 && status.closeCode == 0) {
        fs.readdir(downloadDir,async function(err,files) {
            if (err) {
                result.files =[];
                return emitter.emit('result',result);
            }
            result.files = files.map(function(file) {
               return path.join(downloadDir,"/"+file); 
            });

            if (getscuObj.option.directory) {
                await moveToDirectory(result.files,getscuObj.option.directory,function(files) {
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
/**
 * 按patientid的文件下载目录
 * @param {*} spawnArgs 
 * @param {*} pid 
 */
function updateTmpDirByPid(spawnArgs,pid){
    let index = spawnArgs.args.indexOf('--directory');
    let tmpBase = spawnArgs.args[index+1];
    let downloadDir = path.join(tmpBase,'/'+pid,uuid());
    spawnArgs.args.splice(index+1,index+2,downloadDir);
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
        try {
            await fse.move(file,path.join(destDir,path.basename(file)),{ overwrite: true }); 
        } catch (error) {
            err_count++;
        }
        newFiles.push(path.join(destDir,path.basename(file)));
    }
    if (err_count>0) {
        for (const element of newFiles) {
            if (fs.existsSync(element)) {
                await fse.remove(element);
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


module.exports = GetSCU;