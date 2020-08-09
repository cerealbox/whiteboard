// draw a series of line segments onto a canvas context:
//@NOTE: data should have members: colour, pen, and points[{x, y}].
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

if (typeof module !== 'undefined')
    module.exports = draw