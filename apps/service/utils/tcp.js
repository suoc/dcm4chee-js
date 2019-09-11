/**
 * 
 */
const EventEmitter = require('events');
const net = require('net');

const tcpService = require('./services/tcpService');

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
        session.remoteSocket.connect(remoteOption);
        session.socket.pipe(session.remoteSocket); 
        session.remoteSocket.pipe(session.socket);
    }
    
}

function listenServerEvents(tcpServer) {
    tcpServer.server.on('connection',function(socket) {
        let emitter = new EventEmitter();
        emitter.socket = socket;
        tcpService.createPip(emitter,tcpServer);
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