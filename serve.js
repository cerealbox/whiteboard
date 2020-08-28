var log = console.log.bind(console)

// ===============================================================================================================
const WebSocketServer = require('ws').Server
const express = require('express')
const cookie = require('cookie')
const events = require('events')
const gzipStatic = require('connect-gzip-static')
const zlib = require('zlib')

// ===============================================================================================================
function serve(secure = false) {

    const app = express()
    const server = secure ? require('https').createServer({}, app) : require('http').createServer(app)

    let wss = new WebSocketServer({ server: server })
    let em = new events.EventEmitter()
    em.clients = wss.clients

    // generate random cookie id if missing:
    app.use(function (req, res, next) {
        let id = cookie.parse(req.headers.cookie || '')['id']
        if (id === undefined) {
            res.cookie('id', Math.random().toString(), { maxAge: (1000 * 60 * 60 * 24), httpOnly: true, secure })
        }
        next()
    })

    // app.get('/', (req, res) => {
    //  log(req.connection.remoteAddress)
    //  res.send('Hello.')
    // })

    //app.use(express.static('.'))
    // allow pre-compressed (.gz) files to be served as well as regular uncompressed files.
    app.use(gzipStatic('.'))
    
    // redirect any 404 not found to index.html instead:
    app.use((req, res) => {
        res.redirect('/')
    })

    wss.on('connection', (client, req) => {
        
        let ipport = `//${req.connection.remoteAddress}:${req.connection.remotePort}${req.url}`
        console.log(`[client connection: ${ipport}]`)

        let id = cookie.parse(req.headers.cookie || '')['id']

        client.id = id
        client.upgradeReq = req
        client.ipport = ipport
        client.timeout = 0

        client.write = (x) => {
            x.id = client.id
            let xs = JSON.stringify(x)
            
            if (client.readyState == client.OPEN) {
                try {
                    //client.send(xs.length > 1500 ? zlib.gzipSync(xs) : xs)
                    if (xs.length > 1500) {
                        let zxs = zlib.gzipSync(xs)
                        log("u:", xs.length, "c:", zxs.length)
                        client.send(zxs)
                    } else {
                        client.send(xs)
                    }
                } catch(e) {
                    client.close()
                }
            }                
        }

        client.writeAll = (x) => {
            for (let c of wss.clients) {
                if (c != client)
                    c.write(x)
            }
        }

        client.read = (x) => JSON.parse(x)

        client.addEventListener('close', () => {
            console.log(`[client disconnected: ${ipport}]`)
        })

        // reject client if it is missing an id:
        if (!client.id) {
            console.log(`[client rejected with no id: ${client.ipport}]`)
            client.close()
            return        
        }

        client.on('message', (data) => {
            client.timeout = 0
        })

        //console.log(`[client accepted: ${ipport}]`)
        em.emit('connection', client)
    })

    // increment timeouts every second and close lost connections:
    setInterval(() => {
        for (let client of wss.clients) {
            if (client.timeout++ > 10) {
                log(`[timeout client ${client.ipport} with id ${client.id}]`)
                client.close()
            }
        }
    }, 1000)

    const PORT = secure ? 443 : 80
    server.listen(PORT, () => { 
        log("[websocket and static server listening on " + "localhost" + ":" + PORT + "]")
    })

    return em
}

module.exports = serve
