/**
 * 
 */
const EventEmitter = require('events');
const net = require('net');

class Tcp extends EventEmitter{
    constructor(option){
        super();
        if (!option.port) {
            throw new Error('option.port must apply!');
        }
        this.server = net.createServer();
        let _this = this;
        this.server.listen(option.port,function(err) {
            if (err) {
                throw err;
            }
            _this.emit('open',option);
        })

        listenServerEvents(this);
    }

    proxyTo(session,remoteOption){
        let localSocket = session.socket;
        let _this = this;
        let remoteSocket = new net.Socket();
        remoteSocket.connect(remoteOption);
        localSocket.pipe(remoteSocket); 
        remoteSocket.pipe(localSocket);

        localSocket.on('end',function(){
            // console.log('============local socket ended!========');
            localSocket.destroy();
        });
        remoteSocket.on('end',function(){
            // console.log('============remote socket ended!========');
            remoteSocket.destroy();
            _this.emit('session_end',{localSocket: localSocket,remoteSocket: remoteSocket});
        });
        localSocket.on('close',function(){
            // console.log('============local socket closed!========');
            // localSocket.destroy();
            session.emit('close');
        });
        remoteSocket.on('close',function(){
            // console.log('============remote socket closed!========');
            _this.emit('session_close',{localSocket: localSocket,remoteSocket: remoteSocket});
        });
    }
    
}

function listenServerEvents(tcpServer) {
    tcpServer.server.on('connection',function(socket) {
        let emitter = new EventEmitter();
        emitter.socket = socket;
        tcpServer.emit('connection',emitter); 
    });
}

function test(params) {
    let tcp1 = new Tcp({
        port: 11112
    });
    tcp1.on('open',function(option) {  
        console.log('======open=========');
    });
    tcp1.on('connection',function(socket) {  
        console.log('======connection=========');
        tcp1.proxyTo(socket,{
            port: 10003
        })
    });
}

module.exports = Tcp;