// connect to websocket server, return a promise containing the socket:
function connect() {
    
    return new Promise((resolve, reject) => {
        log("[connecting to websocket]")

        let proto = (window.location.protocol == 'https:') ? "wss://" : "ws://"
        let socket = new WebSocket(proto + location.host + "/ws")

        //@NOTE: use this .write() instead of .send()
        socket.write = (x) => {
            if (socket.readyState == socket.OPEN) {
                try {
                    socket.send(x)
                } catch(e) {
                    socket.close()
                }
            }
        }

        socket.addEventListener('close', () => {
            log("[websocket closed]")
        })
        socket.onopen = () => {
            log("[websocket connected]")
            resolve(socket)
        }
        
        socket.addEventListener('error', reject)
    })
}
