var log = console.log.bind(console)

const {createCanvas, loadImage} = require('canvas')
const {sleep, serve} = require('./serve')
const fs = require('fs')

let wss = serve()

let boards = {}

function draw(ctx, data) {

    // draw data points on context:
    if (data.pen) {
        ctx.strokeStyle = data.colour
        ctx.lineWidth = 2
    } else {
        ctx.strokeStyle = "rgb(0,0,0)"
        ctx.fillStyle =   "rgb(0,0,0)"
        ctx.lineWidth = 20
    }

    if (data.points.length == 1) {
        ctx.strokeRect(data.points[0].x, data.points[0].y, 1, 1)
        if (!data.pen)
            ctx.fillRect(data.points[0].x - 10, data.points[0].y - 10, 20, 20)
    } else {
        ctx.beginPath()
        ctx.moveTo(data.points[0].x, data.points[0].y)
        for (let {x, y} of data.points.slice(1)) {
            ctx.lineTo(x, y)
            if (!data.pen)
                ctx.fillRect(x - 10, y - 10, 20, 20)                
        }
        ctx.stroke()
    }
}

let zindex = 0
wss.on('connection', (client) => {

    // reject client if it is missing an id:
    if (!client.id) {
        console.log(`[client rejected with no id: ${client.ipport}]`)
        client.close()
        return        
    }
    // reject client if it is using the same id as another connected client:
    if (boards[client.id] && boards[client.id].client) {
        console.log(`[client rejected with duplicate id: ${client.ipport} ${client.id}]`)
        client.close()
        return
    }
    console.log(`[client accepted with id: ${client.ipport} ${client.id}]`)


    // link client to existing canvas or create new one:
    if (client.id in boards)
        boards[client.id].client = client
    else
        boards[client.id] = {client, canvas: createCanvas(2560, 1600), undo: [], lastUpdate: (new Date()).getTime(), zindex: zindex++ }

    // unlink client from canvas on disconnection:
    client.on('close', () => {
        boards[client.id].client = null
    })

    //@TODO: clients that never come back will cause unused canvas to sit in memory and stuff.
    //       clear out abandonded canvases every minute.

    // accept drawing commands:
    client.on('message', (data) => {
        data = JSON.parse(data)
        //log(data)
        
        let board = boards[client.id]
        switch (data.type) {
            case "update":

                board.undo.push(data)
                if (board.undo.length > 10)
                    draw(board.canvas.getContext('2d'), board.undo.shift())

                // spit back out to all clients:
                data.id = client.id
                ;[...wss.clients].filter(c => c != client).forEach(c => {
                    c.write(data)
                })
                break
            
            case "undo":

                board.undo.pop()

                // spit back out to all clients:
                data.id = client.id
                ;[...wss.clients].filter(c => c != client).forEach(c => {
                    c.write(data)
                })
                //@TODO: reusable function writeAll(data)
                break
        }
    })

    // send inital boards:
    client.write({
        type: "init",
        boards: Object.fromEntries(Object.entries(boards).map(([id, {canvas, undo}]) => {
            return [id, { image: canvas.toDataURL(), undo }]
        })),
        id: client.id
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
