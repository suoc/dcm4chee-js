/**
 * 
 *  */
const net = require('net');

class tcpService {

    static createPip(session,tcpServerObj){
        let localSocket = session.socket;
        let _this = tcpServerObj;
        let remoteSocket = new net.Socket();
        session.remoteSocket = remoteSocket;
        // remoteSocket.connect(remoteOption);
        // localSocket.pipe(remoteSocket); 
        // remoteSocket.pipe(localSocket);

        localSocket.on('end',function(){
            // console.log('============local socket ended!========');
            localSocket.destroy();
        });
        localSocket.on('error',function(error){
            // console.log('============local socket ended!========');
            throw error;
        });
        localSocket.on('close',function(){
            // console.log('============local socket closed!========');
            // localSocket.destroy();
            session.emit('close');
        });
        remoteSocket.on('end',function(){
            // console.log('============remote socket ended!========');
            remoteSocket.destroy();
            _this.emit('session_end',{localSocket: localSocket,remoteSocket: remoteSocket});
        });
        remoteSocket.on('error',function(error){
            // console.log('============local socket ended!========');
            throw error;
        });
        remoteSocket.on('close',function(){
            // console.log('============remote socket closed!========');
            _this.emit('session_close',{localSocket: localSocket,remoteSocket: remoteSocket});
        });
    }

}

module.exports = tcpService;