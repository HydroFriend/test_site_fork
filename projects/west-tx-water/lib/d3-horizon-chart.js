// https://github.com/kmandov/d3-horizon-chart Version 0.0.5. Copyright 2016 Kiril Mandov.
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('d3-selection'), require('d3-scale'), require('d3-axis'), require('d3-array')) :
    typeof define === 'function' && define.amd ? define(['exports', 'd3-selection', 'd3-scale', 'd3-axis', 'd3-array'], factory) :
    (factory((global.d3 = global.d3 || {}),global.d3,global.d3,global.d3,global.d3));
}(this, (function (exports,d3Selection,d3Scale,d3Axis,d3Array) { 'use strict';

function horizonChart () {

    // default settings:
    //var colors = ['#08519c','#3182bd','#6baed6','#bdd7e7','#bae4b3','#74c476','#31a354','#006d2c'],
    //var colors = ['#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#fee090', '#fdae61', '#f46d43', '#d73027'],
    //var colors = ["#5e4fa2", "#3288bd", "#66c2a5", "#abdda4", "#e6f598", "#fee08b", "#fdae61", "#f46d43", "#d53e4f", "#9e0142"],
    var colors = ["#313695", "#4575b4", "#74add1", "#abd9e9", "#fee090", "#fdae61", "#f46d43", "#d73027"],
        bands = colors.length >> 1, // number of bands in each direction (positive / negative)
        width = 1000, // width in pixels
        height = 30,
        offsetX = 0,
        step = 1,
        spacing = 0,
        mode = 'offset',
        axis = null,
        title = null,
        extent = null, // the extent is derived from the data, unless explicitly set via .extent([min, max])
        //x = d3.scaleLinear(), // TODO: use ordinal scale instead?
        x = null,
        y = d3Scale.scale.linear().range([0, height]),
        canvas = null;


    // Appends a canvas element to the current element
    // and draws a horizon graph based on data & settings
    function my(data) {

        var horizon = d3Selection.select(this);
        var dIncrement = step + spacing;

        // update the width
        //width = horizon.node().getBoundingClientRect().width;
        width = dIncrement * data.length;

        canvas = horizon.append('canvas');

        canvas
            .attr('width', width)
            .attr('height', height);

        horizon.append('span')
            .attr('class', 'title')
            .text(title);

        horizon.append('span')
            .attr('class', 'value');

        var context = canvas.node().getContext('2d');
        //context.imageSmoothingEnabled = false;
        //context.translate(margin.left, margin.top);

        // update the y scale, based on the data extents
        var _extent = extent || d3Array.extent(data);

        var max = Math.max(-_extent[0], _extent[1]);
        y.domain([0, max]);


        //x = d3.scaleTime().domain[];

        // axis = d3Axis.axisTop(x).ticks(5);
        axis = d3.svg.axis().orient("top").scale(x).ticks(5);


        // Draw ----------------------------------------------------------------------------

        context.clearRect(0, 0, width, height);
        //context.translate(0.5, 0.5);

        // the data frame currently being shown:
        var increment = step + spacing,
            startIndex = ~~Math.max(0, -(offsetX / increment)),
            endIndex = ~~Math.min(data.length, startIndex + width / increment);

        // skip drawing if there's no data to be drawn
        if (startIndex > data.length) return;


        // we are drawing positive & negative bands separately to avoid mutating canvas state
        // http://www.html5rocks.com/en/tutorials/canvas/performance/

        var negative = false;
        // draw positive bands
        for (var b = 0; b < bands; b++) {
            context.fillStyle = colors[bands + b];

            // Adjust the range based on the current band index.
            var bExtents = (b + 1 - bands) * height;
            let range_from = bands * height + bExtents;
            y.range([range_from, bExtents]);

            // only the current data frame is being drawn i.e. what's visible:
            for (var i = startIndex, value; i < endIndex; i++) {
                value = data[i];
                if (value <= 0) { negative = true; continue; }
                if (value === undefined) continue;
                let upper_left_x = offsetX + i * increment;
                let upper_left_y = y(value);
                let with_rect = step;
                let height_rect = range_from - upper_left_y;

                context.fillRect(upper_left_x, upper_left_y, with_rect , height_rect);
            }
        }

        // draw negative bands
        if (negative) {

            // mirror the negative bands, by flipping the canvas
            if (mode === 'offset') {
                context.translate(0, height);
                context.scale(1, -1);
            }

            for (b = 0; b < bands; b++) {
                context.fillStyle = colors[bands - b - 1];

                // Adjust the range based on the current band index.
                bExtents = (b + 1 - bands) * height;
                y.range([bands * height + bExtents, bExtents]);

                // only the current data frame is being drawn i.e. what's visible:
                for (var j = startIndex, nvalue; j < endIndex; j++) {
                    nvalue = data[j];
                    if (nvalue >= 0) continue;
                    context.fillRect(offsetX + j * increment, y(-nvalue), step, y(0) - y(-nvalue));
                }
            }
        }


		/*
	    // Offscreen Draw -----------------------------------------------------------------------

		function createOffscreenCanvas(width,height){
		    var canvas = document.createElement('canvas');
		    canvas.width = width;
		    canvas.height = height;
		    return canvas;
		}

		var offscreenCanvas = createOffscreenCanvas(increment * data.length, height);
		var offscreenContext = offscreenCanvas.getContext('2d');
	    // draw each band:
	    for (var b = 0; b < bands; b++) {
	        offscreenContext.fillStyle = colors[b];

	        // Adjust the range based on the current band index.
	        var y0 = (b + 1 - bands) * height;
	        y.range([bands * height + y0, y0]);

	        // draw the whole period on an offscreen canvas
	        for (var i = 0; i < data.length; i++) {
	          offscreenContext.fillRect(i * increment, y(data[i]), step, y(0) - y(data[i]));
	        }
	    }

	    var onscreenImage;
	    _draw = function() {
	    	onscreenImage = offscreenContext.getImageData(-offsetX, 0, width, height);
            context.putImageData(onscreenImage, 0, 0);

            //context.clearRect(0, 0, width, height);
            //context.translate(offsetX, 0);
            //context.drawImage(offscreenCanvas, offsetX, 0);
	    };
	    */


    }

    my.axis = function (_) {
        return arguments.length ? (axis = _, my) : axis;
    };

    my.canvas = function (_) {
        return arguments.length ? (canvas = _, my) : canvas;
    };

    // Array of colors representing the number of bands
    my.colors = function (_) {
        if (!arguments.length) return colors;
        colors = _;

        // update the number of bands
        bands = colors.length >> 1;

        return my;
    };

    // get/set the height of the graph
    my.height = function (_) {
        return arguments.length ? (height = _, my) : height;
    };

    // get/set the step of the graph, i.e. the width of each bar
    my.step = function (_) {
        return arguments.length ? (step = _, my) : step;
    };

    // get/set the spacing between the bars of the graph
    my.spacing = function (_) {
        return arguments.length ? (spacing = _, my) : spacing;
    };

    // get/set the title of the horizon
    my.title = function (_) {
        return arguments.length ? (title = _, my) : title;
    };

    // mirror or offset
    my.mode = function (_) {
        return arguments.length ? (mode = _, my) : mode;
    };

    // get/set the extents of the Y axis. If not set the extents are derived from the data
    my.extent = function (_) {
        return arguments.length ? (extent = _, my) : extent;
    };

    my.offsetX = function (_) {
        return arguments.length ? (offsetX = _, my) : offsetX;
    };

    // the data frame currently being shown:
    my.indexExtent = function () {
        var increment = step + spacing,
            startIndex = -offsetX / increment,
            endIndex = startIndex + width / increment;

        return [startIndex, endIndex];
    };

    return my;

}

exports.horizonChart = horizonChart;

Object.defineProperty(exports, '__esModule', { value: true });

})));