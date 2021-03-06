var log = console.log.bind(console)

//@TODO: implement http caching:
// https://medium.com/@codebyamir/a-web-developers-guide-to-browser-caching-cc41f3b73e7c

//@TODO:
//interesting...https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/putImageData

//@TODO: hmmm... new Path2D() ???
// var rectangle = new Path2D();
// rectangle.rect(10, 10, 50, 50);
// ctx.stroke(rectangle)

//@TODO: size of all buffer canvasas, currently res: {width: 2560, height: 1600}, should be, like, 4000x4000
// so all tablet resolutions and orientations fit within it.

//===============================================================================================================================================
//===============================================================================================================================================
document.body.onload = {
    settings: {
        colours: {
            red: "rgb(255,0,0)",
            blue: "rgb(0,0,255)",
            orange: "rgb(255,165,0)",
            magenta: "rgb(255,0,255)",
            cyan: "rgb(0,255,255)",
            green: "rgb(0,255,0)",
            white: "rgb(255,255,255)",
            yellow: "rgb(255,255,0)"
        },
        pen: true,
        colour: "rgb(255,255,0)"
    },
    mouse: null,
    keys: {},
    res: {width: 2560, height: 1600},
    pos: {x: 0, y: 0},
    socket: null,
    boards: {},
    id: null,
    ctx: null,
    scratchCanvas: null,
    scratchCtx: null,

    init(data) {
        this.boards = data.boards
        this.id = data.id
        let ctx = document.getElementById("canvas").getContext("2d")
        this.ctx = ctx

        // scratch canvas for undo operations:
        this.scratchCanvas = document.createElement('canvas')
        // another option? https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas
        this.scratchCanvas.width = document.body.clientWidth
        this.scratchCanvas.height = document.body.clientHeight
        this.scratchCtx = this.scratchCanvas.getContext("2d")
        
        //scale canvas to size of browser window:
        ctx.canvas.width = document.body.clientWidth
        ctx.canvas.height = document.body.clientHeight
        log(ctx.canvas.width + "x" + ctx.canvas.height)

        // convert encoded images into canvass:
        //@TODO: we might need to wait until all the .onload()'s fire before starting to render?
        // otherwise you would be able to start drawing before actually seeing the images from the server.
        // the time window is so small though - between image fully download and copying to ctx..hmm..
        for (let id in this.boards) {
            let canvas = document.createElement('canvas')
            canvas.width = this.res.width
            canvas.height = this.res.height
            this.boards[id].canvas = canvas
            let img = new Image()
            let ctx = canvas.getContext('2d')
            this.boards[id].ctx = ctx
            img.onload = () => {
                ctx.drawImage(img, 0, 0)
            }
            img.src = this.boards[id].image
        }

        //@TODO: grap 'settings' from local storage:
        //localStorage.setItem('myCat', 'Tom');
        //var cat = localStorage.getItem('myCat');
        //localStorage.removeItem('myCat');

        this.setupEventHandlers()
        window.requestAnimationFrame(this.render.bind(this))
    },
    setupEventHandlers() {
        //let ctx = this.boards[this.id].ctx

        //@TODO: HERE, write new lines to an undo context:
        //let ctx = this.boards[this.id].undo[this.boards[this.id].undo.length - 1].ctx
        let ctx = this.scratchCtx
        let canvas = document.getElementById("canvas")

        // 
        // let canvas = document.createElement('canvas')
        // canvas.width = this.res.width
        // canvas.height = this.res.height
        // let ctx = canvas.getContext('2d')
        //

        let points = []
        let pendown = (x, y) => {
            points = []
        
            if (this.settings.pen) {
                ctx.strokeStyle = this.settings.colour
                ctx.lineWidth = 1
            } else {
                ctx.lineWidth = 20
                ctx.strokeStyle = "rgb(0,0,0)"
                ctx.fillStyle =   "rgb(0,0,0)"
                ctx.fillRect(x - 10, y - 10, 20, 20)
            }
                        
            ctx.beginPath()
            ctx.moveTo(x, y)
            points.push({x, y})
        }
        let penmove = (x, y) => {
            this.mouse = {x, y}
            //@TODO: should we really add to the line if mouse cursor is outside the browser window?
            ctx.lineTo(x, y)
            points.push({x, y})
            ctx.stroke()
            if (!this.settings.pen)
                ctx.fillRect(x - 10, y - 10, 20, 20)
        }
        let penup = (x, y) => {
            this.mouse = null

            if (points.length == 1) {
                ctx.strokeRect(x, y, 1, 1)
            } else {
                ctx.lineTo(x, y)
                points.push({x, y})
                ctx.stroke()
                if (!this.settings.pen)
                    ctx.fillRect(x - 10, y - 10, 20, 20)
            }

            let data = { type: "update", pen: this.settings.pen, points, colour: this.settings.colour }
            data = {...data, points: data.points.map(({x, y}) => ({x: x + this.pos.x, y: y + this.pos.y}))} //transform.
            ctx.clearRect(0, 0, this.scratchCanvas.width, this.scratchCanvas.height)
            
            this.boards[this.id].undo.push(data)
            if (this.boards[this.id].undo.length > 10) {
                draw(this.boards[this.id].ctx, this.boards[this.id].undo.shift())
            }

            this.write(data)
        }

        // tablet:
        let tablet = false
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault()
            tablet = true

            if (this.select(e.touches[0].clientX, e.touches[0].clientY))
                return;

            if (e.touches.length == 1) {
                //pendown(e.touches[0].clientX, e.touches[0].clientY)
                pendown(Math.round(e.touches[0].clientX), Math.round(e.touches[0].clientY))
                function move(e) {
                    e.preventDefault()
                    //penmove(e.touches[0].clientX, e.touches[0].clientY)
                    penmove(Math.round(e.touches[0].clientX), Math.round(e.touches[0].clientY))
                }
                function end(e) {
                    e.preventDefault()
                    //penup(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
                    penup(Math.round(e.changedTouches[0].clientX), Math.round(e.changedTouches[0].clientY))
                    canvas.removeEventListener('touchmove', move)
                    canvas.removeEventListener('touchend', end)
                    canvas.removeEventListener('touchcancel', end)
                }
                canvas.addEventListener('touchmove', move)
                canvas.addEventListener('touchend', end)
                canvas.addEventListener('touchcancel', end)
            } else {
                log("double touch!")
                //@TODO: undo any line drawn with the first finger?
                //@TODO: then pan and zoom.
            }
        })

        // desktop:
        canvas.addEventListener('mousedown', (e) => {
            if (tablet)
                return;

            if (this.select(e.clientX, e.clientY))
                return;

            pendown(e.clientX, e.clientY)
            function move(e) {
                penmove(e.clientX, e.clientY)
            }
            function end(e) {
                penup(e.clientX, e.clientY)
                canvas.removeEventListener('mousemove', move)
                canvas.removeEventListener('mouseup', end)
            }
            canvas.addEventListener('mousemove', move)
            canvas.addEventListener('mouseup', end)
        })

        // prevent right click on canvas:
        document.addEventListener("contextmenu", function(e) { e.preventDefault() })

        //enable some keyboard controls:
        let topleft = {x: 0, y: 0}
        document.onkeydown = (e) => {
            if (e.key == 'z') {
                this.boards[this.id].undo.pop()
                this.write({type: "undo"})
            } else if (e.key == '1') {
                this.settings.pen = true
                this.settings.colour = this.settings.colours.yellow
            } else if (e.key == '2') {
                this.settings.pen = true
                this.settings.colour = this.settings.colours.cyan
            } else if (e.key == '3') {
                this.settings.pen = true
                this.settings.colour = this.settings.colours.orange
            } else if (e.key == '4') {
                this.settings.pen = true
                this.settings.colour = this.settings.colours.magenta
            } else if (e.key == 'e') {
                this.settings.pen = false
            }
            this.keys[e.key] = true
        }
        document.onkeyup = (e) => {
            delete this.keys[e.key]
        }
        setInterval(() => {
            if (this.keys["w"])
                this.pos.y -= 2
            if (this.keys["s"])
                this.pos.y += 2
            if (this.keys["a"])
                this.pos.x -= 2
            if (this.keys["d"])
                this.pos.x += 2
        }, 10)

    },
    fps: (() => {
        //display fps:
        let frames = 0
        let start = (new Date()).getTime()
        let fps = 0
        return (ctx) => {

            frames++
            let end = (new Date()).getTime()
            if (end - start >= 1000) {
                fps = frames
                start = end
                frames = 0
            }
            // display fps:
            ctx.fillStyle = "rgb(255,255,255)"
            ctx.font = "20pt Courier New"
            ctx.fillText(fps + "fps", 0, 20)
        }
    })(),
    controls(ctx) {

        //yellow
        ctx.strokeStyle = "rgb(255,255,0)"
        ctx.lineWidth = this.settings.colour == this.settings.colours.yellow && this.settings.pen ? 2 : 1
        ctx.strokeRect(100, 10, 20, 20)

        //cyan
        ctx.strokeStyle = "rgb(0,255,255)"
        ctx.lineWidth = this.settings.colour == this.settings.colours.cyan && this.settings.pen ? 2 : 1
        ctx.strokeRect(150, 10, 20, 20)

        //orange
        ctx.strokeStyle = "rgb(255,165,0)"
        ctx.lineWidth = this.settings.colour == this.settings.colours.orange && this.settings.pen ? 2 : 1
        ctx.strokeRect(200, 10, 20, 20)

        //magenta
        ctx.strokeStyle = "rgb(255,0,255)"
        ctx.lineWidth = this.settings.colour == this.settings.colours.magenta && this.settings.pen ? 2 : 1
        ctx.strokeRect(250, 10, 20, 20)

        //erase
        ctx.strokeStyle = "rgb(255,255,255)"
        ctx.lineWidth = this.settings.pen ? 1 : 2
        ctx.strokeRect(300, 10, 20, 20)
        ctx.strokeRect(305, 15, 10, 10)

        //undo
        ctx.strokeStyle = "rgb(255,255,255)"
        ctx.lineWidth = 1
        ctx.strokeRect(350, 10, 20, 20)
        ctx.font = "20pt Courier New"
        ctx.fillStyle = "rgb(155,155,155)"
        ctx.fillText("z", 352, 27)

    },
    select(x, y) {

        //@TODO: conrtols drawing and handling (above) are pretty barabaric :)
        if (y >= 10 && y <= 30) {
            if (x >= 100 && x <= 120) {
                this.settings.pen = true
                this.settings.colour = this.settings.colours.yellow
                return true
            } else if (x >= 150 && x <= 170) {
                this.settings.pen = true
                this.settings.colour = this.settings.colours.cyan
                return true
            } else if (x >= 200 && x <= 220) {
                this.settings.pen = true
                this.settings.colour = this.settings.colours.orange
                return true
            } else if (x >= 250 && x <= 270) {
                this.settings.pen = true
                this.settings.colour = this.settings.colours.magenta
                return true
            } else if (x >= 300 && x <= 320) {
                this.settings.pen = false
                return true
            } else if (x >= 350 && x <= 370) {
                this.boards[this.id].undo.pop()
                this.write({type: "undo"})
                return true
            }
        }
        return false
    },
    render() {
        let ctx = this.ctx

        ctx.clearRect(0, 0, this.res.width, this.res.height)
        let boards = Object.keys(this.boards).sort((a, b) => this.boards[a].zindex - this.boards[a].zindex).reverse()
        for (let id of boards) {
            ctx.drawImage(this.boards[id].canvas, this.pos.x, this.pos.y, this.res.width, this.res.height, 0, 0, this.res.width, this.res.height)
            for (let data of this.boards[id].undo) {
                // if (path.canvas) {
                //     //@TODO: we could determine the bounding box of a path after it's creation and store it in the data.
                //     //let {x, y, width, height} = path
                //     let {x, y, width, height} = {x: 0, y: 0, width: this.res.width, height: this.res.height}
                //     ctx.drawImage(path.canvas, this.pos.x + x, this.pos.y + y, width, height, x, y, width, height)
                // } else
                    data = {...data, points: data.points.map(({x, y}) => ({x: x - this.pos.x, y: y - this.pos.y}))} //transform.
                    draw(ctx, data)
            }
            //ctx.drawImage(invisCanvas, topleft.x, topleft.y, ctx.canvas.width, ctx.canvas.height, 0, 0, ctx.canvas.width, ctx.canvas.height)
        }

        // overlay scratch canvas:
        ctx.drawImage(this.scratchCanvas, 0, 0, this.scratchCanvas.width, this.scratchCanvas.height, 0, 0, this.scratchCanvas.width, this.scratchCanvas.height)

        this.fps(ctx) //display fps.
        this.controls(ctx) //display touch controls.

        // draw eraser guiding square:
        if (!this.settings.pen && this.mouse) {
            ctx.strokeStyle = "rgb(255,0,0)"
            ctx.lineWidth = 2
            ctx.strokeRect(this.mouse.x - 10, this.mouse.y - 10, 20, 20)
        }

        window.requestAnimationFrame(this.render.bind(this))
    },
    update(data) {

        // if id not in boards, it must be a new client?  right?  so generate a new board:
        if (!(data.id in this.boards)) {
            log(`drawings from new client: ${data.id}.`)
            let canvas = document.createElement('canvas')
            canvas.width = this.res.width
            canvas.height = this.res.height
            let ctx = canvas.getContext('2d')
            this.boards[data.id] = {image: null, undo: [], canvas, ctx }
        }

        //draw(this.boards[data.id].ctx, data)
        //@TODO: should the data paths be converted into canvass or left as paths???
        let board = this.boards[data.id]
        board.undo.push(data)
        if (board.undo.length > 10) {
            //@TODO: this doesn't seem right, why would i transform incomming lines from other clinets?
            ////data = {...data, points: data.points.map(({x, y}) => ({x: x - this.pos.x, y: y - this.pos.y}))} //transform.
            //what was i thinking here?
            draw(board.ctx, board.undo.shift())
        }

    },
    undo(data) {
        let board = this.boards[data.id]
        
        // if id not in boards, its a new client who pressed undo first, so just ignore.
        if (!board)
            return

        board.undo.pop()
    },
    write(data) {
        this.socket.write(JSON.stringify(data))
    },
    read(data) {
        return JSON.parse(data)
    },
    async load() {
        let socket = await connect()
          
        socket.addEventListener('message', ({data}) => {
            data = this.read(data)
            this[data.type](data)
        })
        
        //@TODO: causes constant refresh if you open a second tab!!!!!
        socket.addEventListener('close', () => {
            setTimeout(() => location.reload(), 1000) // reconnect on disconnect.
        })
        this.socket = socket
        setInterval(() => this.write({type: "ping"}), 5000) // send keepalive ping every 5 seconds.
    }
}.load()
