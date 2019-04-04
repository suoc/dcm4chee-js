/**
 * SCP
 */
const path = require('path');
const scpCom = 'storescp.bat';
const option = {
    encoding: 'utf-8',
    cwd: './apps/lib/dcm4che-5.12.0/bin/'
};
let args = ['-b','BSCAE:10003',
            '--directory',path.join(path.dirname(require.main.filename),'/dcmFiles-scp/'),
            '--filepath','{00100020}/{0020000D}/{0020000E}/{00080018}.dcm',
            '--not-async',
            /* '--sop-classes',path.join(path.dirname(require.main.filename),'/dcmFiles-scp/sop-classes.properties') */];
// let args = ['-h'];

const {spawn}  = require('child_process');
const fs = require('fs');

const spawnObj = spawn(scpCom, args, option);

// console.log(Object.keys(spawnObj));
spawnObj.stdout.on('data', function(chunk) {
    console.log('================> stdout =>');
    console.log(chunk.toString());
    fs.writeFile(path.join(path.dirname(require.main.filename),'./logs/testscp_log.txt'),'================> stdout =>\r\n'+chunk.toString(),{flag: 'a'},function(params) {
        
    });
});
spawnObj.stderr.on('data', (data) => {
    console.log('================> stderr =>');
    console.log(data.toString());
});
spawnObj.on('close', function(code) {
    console.log('=============>close code : ' + code);
})
spawnObj.on('exit', (code) => {
    console.log('=============>exit code : ' + code);
    /* fs.close(fd, function(err) {
        if(err) {
            console.error(err);
        }
    }); */
});