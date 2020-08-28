var log = console.log.bind(console)

const {createCanvas, loadImage} = require('canvas')
const fs = require('fs')
const serve = require('./serve')
const draw = require('./draw')

// ================================================================================================
let boards = {}
let zindex = 0

serve().on('connection', async (client) => {

    // reject client if it is using the same id as another connected client:
    if (boards[client.id] && boards[client.id].client) {
        console.log(`[client rejected with duplicate id: ${client.ipport} ${client.id}]`)
        client.close()
        return
    }
    console.log(`[client accepted with id: ${client.ipport} ${client.id}]`)

    // link client to existing canvas or create new one:
    if (client.id in boards) {
        boards[client.id].client = client
        boards[client.id].lastConnect = (new Date()).getTime()
    } else {
        boards[client.id] = {client, canvas: createCanvas(2560, 1600), undo: [], lastConnect: (new Date()).getTime(), zindex: zindex++ }
    }

    let board = boards[client.id]

    // unlink client from canvas on disconnection:
    client.on('close', () => board.client = null)

    // accept drawing commands:
    client.on('message', (data) => {
        data = client.read(data)
        //log(client.id, data)
        
        switch (data.type) {

            case "update":
                board.undo.push(data)
                if (board.undo.length > 10)
                    draw(board.canvas.getContext('2d'), board.undo.shift())
                break
            
            case "undo":
                board.undo.pop()
                break

            case "ping":
                return
        }
        client.writeAll(data)
    })

    // send inital boards:
    client.write({
        type: "init",
        boards: Object.fromEntries(Object.entries(boards).map(([id, {canvas, undo}]) => {
            //@TODO: canvas.toDataURL() is an expensive (250ms) operation:
            // it can't be regularly parallelized using async/await because an inturruption by
            // client.on('message', (m) => _could_ alter "boards" while it is being read here.
            // if somehow possible though, all boards could be .toDataURL() in parallel, though.  but how?
            // right now what this means is a, like, 0.5-1 second delay on every new client connection.
            // at best it could be 250ms if we can do them all in parallel somehow...
            return [id, { image: canvas.toDataURL(), undo }]
        }))
    })
})

// backup boards to disc every 10 seconds:
setInterval(() => {

    for (id in boards) {
        let out = fs.createWriteStream(`boards/${id}.png`)
        let stream = boards[id].canvas.createPNGStream()
        stream.pipe(out)
        //out.on('finish', () => log(`${id}.png file was updated.`))
    }
}, 10000)



//@TODO: clients that never return will cause unused canvas to sit in memory.  
//       check .lastConnect and clear out abandonded canvases every minute?
//@TODO: load canvas from disc on startup? const canvas = await loadImage('http://server.com/image.png')

//fs.writeFileSync(`${id}.txt`, canvas.toDataURL())

    // function canvasToDataURL(canvas) {
    //     return new Promise((resolve, reject) => {
    //         canvas.toDataURL((err, png) => {
    //             if (err)
    //                 reject(err)
    //             resolve(png)
    //         })
    //     })
    // }
