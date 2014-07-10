var map, geocoder, bounds, markersArray;
var stops;
var isHomepage = $(".home-map").length > 0;

var dottedLine = [{ offset: '0', repeat: '10px', icon: { path: 'M 0,0 0,0.1', strokeOpacity: 1, strokeColor: '#335599', scale: 4 }}];
var dashedLine = [{ offset: '0', repeat: '20px', icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: '#E84813', scale: 4 }}];

var DOM = {
    imgpop: $(".imagepop"),
    map: $("#map"),
    elevation: $("#elevation"),
    arcgauge: function() { return $(".arcgauge"); }
};
        
$(function() {
    // setup any images with magnific popup
     DOM.imgpop.magnificPopup({type:"image"});

    // if there is a map div, setup the google maps api
    var mapDiv = DOM.map;
    if(mapDiv.length > 0) {
        map = buildMap(mapDiv[0]);

        bounds = new google.maps.LatLngBounds();
        markersArray = [];
        var flying = mapDiv.data("travelmode") == "Flying";
        var encodedPath = mapDiv.data("path");
        //var mileage = mapDiv.data("mileage");
        geocoder = new google.maps.Geocoder();
        if(flying || !encodedPath) {
            
            if(isHomepage) {
                alert("Add encoded paths to all posts!");
                return;
            }
            // if stops are defined, add markers and draw a line
            stops = mapDiv.data("stops");
            if(!!stops) {
                stops = _.filter(stops.split("|"), function(val) { return val.trim() != ""; });
                
                if(stops.length > 0) {
                    if(flying) {
                        var line = drawLine(map, null, true, dashedLine);
                        var path = [];
                        _.each(stops, function(element, index, list) {
                            console.log("adding marker for " + element);
                            addMarker(element, path, line);
                        });
                    } else {
                        getWalkingDirections(stops);
                    }
                }
            }
        } else {
            var paths = [];
            if(isHomepage) {
                paths = _.filter(encodedPath.split("-"), function(val) { return val.trim() != ""; });
            } else {
                paths[0] = encodedPath;
            }

            _.each(paths, function(path, index, list) {
                var decodedPath = google.maps.geometry.encoding.decodePath(path);
                drawLine(map, decodedPath);
            });

            // for (var i = 0; i < decodedPath.length; i++) {
            //     bounds.extend(decodedPath[i]);
            // }
            // map.fitBounds(bounds);
            stops = mapDiv.data("stops");
            stops = _.filter(stops.split("|"), function(val) { return val.trim() != ""; });
            // _.each(stops, function(element, index, list) {
            //     console.log("adding marker for " + element);
            //     addMarker(element, path, line);
            // });
            moveMarker = addMarker(_.first(stops), null, null, startIcon);
            addMarker(_.last(stops), null, null, stopIcon);

            buildElevationGraph();

            if(isHomepage) {
                var endDate = new Date(2014, 6, 25);

                if(lastCheckin < endDate && !!mileage && mileage > 0) {
                    var TOTAL_MILES = 460;
                    var TOTAL_DAYS = 22;
                    var timeDiff = Math.abs(endDate.getTime() - lastCheckin.getTime());
                    var daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
                    var daysUsed = TOTAL_DAYS - daysLeft;

                    var model = {
                        milesTraveled: parseInt(mileage),
                        milesLeft: parseInt(TOTAL_MILES-mileage),
                        percentTraveled: parseInt((mileage/TOTAL_MILES)*100),
                        percentDays: parseInt((daysUsed/TOTAL_DAYS)*100),
                        daysLeft: daysLeft,
                        maxElevation: _.max(_.pluck(elevationData, "e"))
                    };
                    model.neededPace = parseFloat(model.milesLeft/daysLeft).toFixed(2);
                    useTemplate("statsTemplate", "stats", model);

                    buildArcGauge(model.percentTraveled, "% traveled", daysUsed, TOTAL_DAYS, "days walking");
                }
            }
        }
    }
});

function buildMap(mapElement) {
    // map style courtesy of snazzymaps.com
    var myOptions = {
        zoom: 4,
        center: new google.maps.LatLng(24.7707546,-39.5417117),
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        streetViewControl: false,
        scrollwheel: false,
        styles:
        // SUBTLE MAP (http://snazzymaps.com/style/19/subtle)
        [{"featureType":"poi","stylers":[{"visibility":"off"}]},{"stylers":[{"saturation":-70},{"lightness":37},{"gamma":1.15}]},{"elementType":"labels","stylers":[{"gamma":0.26},{"visibility":"off"}]},{"featureType":"road","stylers":[{"lightness":0},{"saturation":0},{"hue":"#ffffff"},{"gamma":0}]},{"featureType":"road","elementType":"labels.text.stroke","stylers":[{"visibility":"off"}]},{"featureType":"road.arterial","elementType":"geometry","stylers":[{"lightness":20}]},{"featureType":"road.highway","elementType":"geometry","stylers":[{"lightness":50},{"saturation":0},{"hue":"#ffffff"}]},{"featureType":"administrative.province","stylers":[{"visibility":"on"},{"lightness":-50}]},{"featureType":"administrative.province","elementType":"labels.text.stroke","stylers":[{"visibility":"off"}]},{"featureType":"administrative.province","elementType":"labels.text","stylers":[{"lightness":20}]}]
    };
    return new google.maps.Map(mapElement, myOptions);
}

function drawLine(map, path, geodesic, lineStyle) {
    if(typeof(geodesic)==='undefined') geodesic = false;
    if(typeof(lineStyle)==='undefined') lineStyle = dottedLine;
    if(!path) path = [];

    return new google.maps.Polyline({
        map: map,
        path: path,
        geodesic: geodesic,
        strokeOpacity: 0,
        icons: lineStyle
    });
}

function getWalkingDirections(stops) {
    var origin = stops[0];
    var destination = stops[stops.length-1];
    var waypoints = _.map(_.initial(_.last(stops, stops.length-1))
        , function(val) { return {
            location: val,
            stopover: false
        }
    });
    if(waypoints.length > 8) {
        console.log("Too many waypoints specified, reducing to prevent Google Maps error.");
        waypoints = _.last(waypoints, 8);
    }
    if(isHomepage && waypoints.length > 0) {
        _.last(waypoints).stopover = true;
    }

    var directionsDisplay = new google.maps.DirectionsRenderer({suppressMarkers:true});
    var directionsService = new google.maps.DirectionsService();
    directionsDisplay.setMap(map);
    var request = {
        origin: origin,
        destination: destination,
        waypoints: waypoints,
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.WALKING
    };
    directionsService.route(request, function(response, status) {
        if (status == google.maps.DirectionsStatus.OK) {
            directionsDisplay.setDirections(response);
            getStats(response);
        } else {
            console.log("Error getting route");
        }
    });
}

function addMarker(location, path, line, icon, showInfo) {
    var marker = makeMarker(null, null, icon);
    geocoder.geocode({'address': location}, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
            var latlng = results[0].geometry.location;
            bounds.extend(latlng);
            map.fitBounds(bounds);
            //var marker = makeMarker(latlng, null, icon);
            marker.setPosition(latlng);
            markersArray.push(marker);

            if(showInfo) {
                var infowindow = new google.maps.InfoWindow({
                   content: location
                });
                infowindow.open(map, marker);
            }

            // if drawing a line between markers, update line now
            if(!!path && !!line) {
                var idx = _.indexOf(stops, location);
                path[idx] = latlng;
                if(path.length == stops.length && _.every(path, function(val) { return !!val; })) {
                    line.setPath(path);
                    map.panBy(0, -50);
                }
            }
        } else {
          alert('Geocode was not successful for the following reason: '
            + status);
        }
    });
    return marker;
}
function makeMarker(position, title, icon) {
    return new google.maps.Marker({
        map: map,
        position: position,
        title: title,
        icon: icon
    });
}

function getStats(response) {
    console.log(response);

    if(!!response.routes && response.routes.length > 0) {
        var route = response.routes[0];
//        var legs = route.legs;
        // add markers at start and end
//        makeMarker(legs[0].start_location, "Start");
//        if(legs.length > 1) {
//            makeMarker(legs[0].end_location, "Current");
//            makeMarker(legs[1].end_location, "End");
//            showHomeStats(legs);
//        } else {
//            makeMarker(legs[0].end_location, "End");
//            showDayStats(legs);
//        }

        var elevator = new google.maps.ElevationService();
        elevator.getElevationAlongPath({
            path: route.overview_path,
            samples: 100
        }, function(results, status) {
            // TODO: output the elevation data so we can save it to the post file
            var model = {
                polyline: route.overview_polyline,
                elevation: JSON.stringify(_.map(results, function(val) { return { e:parseInt(val.elevation), l: { lat:val.location.k, lng:val.location.B }}})),
                mileage: kmToMi(route.legs[0].distance.value)
            };
            console.log(model);
            useTemplate("tempTemplate", "temp", model);
        });
    }
}

function useTemplate(templateId, containerId, model) {
    var template = _.template($("#" + templateId).html());
//    console.log(template({model:model}));
    $("#" + containerId).html(template({
        model: model
    }));
}

function kmToMi(val) {
    return parseFloat(val*0.000621371).toFixed(2);
}

var graph, x, hoverLineGroup, hoverLineTextValue, graphArea, area;
var m = [0,0,0,55];
function buildElevationGraph() {
    if(!elevationData[0].e) {
        elevationData = _.flatten(elevationData);
    }

    var el = DOM.elevation;
    var width = el.width()-m[1]-m[3];
    var height = 150;

    x = d3.scale.linear().range([0, width])
        .domain([0, elevationData.length]);
    var y = d3.scale.linear().range([height, 0])
        .domain([d3.min(elevationData, function(d) { return d.e; })
            , d3.max(elevationData, function(d) { return d.e; })]);

    
    area = d3.svg.area()
        .x(function(d,i) { return x(i); })
        .y0(function() { return height - m[2]; })
        .y1(function(d) { return y(d.e); })
        .defined(function(d) { return isFinite(d.e); });
    var line = d3.svg.line()
        .x(function(d,i) { return x(i); })
        .y(function(d) { return y(d.e)});

    graph = d3.select(el[0]).append("svg")
        .attr("width", width + m[1] + m[3])
        .attr("height", height + m[0] + m[2])
      .append("g")
        .attr("transform", "translate(" + m[3] + "," + m[0] + ")");

    // create yAxis
    var yAxisLeft = d3.svg.axis().scale(y).ticks(4).orient("left");
    graph.append("g")
          .attr("class", "y axis")
          .attr("transform", "translate(0,0)")
          .call(yAxisLeft);
    graph.append("text")
        .attr("class", "y axis-label")
        .attr("text-anchor", "end")
        .attr("y", -m[3])
        .attr("x", -40)
        .attr("dy", ".75em")
        .attr("transform", "rotate(-90)")
        .text("elevation (m)");

    // add line and area
    graph.append("path").attr("d", line(elevationData)).attr("class", "line");
    graphArea = graph.append("path").attr("d", area(elevationData)).attr("class", "area");

    // do these last so they show up on top!
    hoverLineGroup = graph.append("g").attr("class", "hover-line")
        .attr("transform", "translate(10)");
    var hoverLine = hoverLineGroup.append("line")
        .attr("x1", 1).attr("x2", 1)
        .attr("y1", m[0]).attr("y2", height - m[2]);
    
    var hoverLineTextValueY = m[0] + 10;
    // var hoverLineTextValueRect = hoverLineGroup.append("rect")
    //             .attr("x", 3).attr("y", hoverLineTextValueY - 10)
    //             .attr("width", 100).attr("height", 10)
    //             .attr("class", "background-rect");
    hoverLineTextValue = hoverLineGroup.append("text")
                .attr("x", 6).attr("y", hoverLineTextValueY)
                .attr("text-anchor", "start")
                .attr("class", "annotation")
                .text("");
    //moveMarker = makeMarker(null, null, startIcon);
    //moveMarker = addm(elevationData[0].l, null, startIcon);
}

$(window).on('resize', function() { redrawElevationGraph(); });
function redrawElevationGraph() {
    var el = DOM.elevation;
    var width = el.width()-m[1]-m[3];
    var height = 150;

    x = d3.scale.linear().range([0, width])
        .domain([0, elevationData.length]);
    graph.attr("width", width + m[1] + m[3]);
    graphArea.attr("d", area(elevationData)).attr("class", "area");
}

var moveMarker;
$(DOM.elevation).on("mousemove touchmove", function(event) {
//    moveMarker.setVisible(true);
    event.preventDefault();
    handleMouseOverGraph(event);
});
$(DOM.elevation).on("mouseleave touchend", function(event) {
//    moveMarker.setVisible(false);
    moveMarker.setPosition(elevationData[0].l);
});
var initDimensions = function(el) {
    // automatically size to the container using JQuery to get width/height
    width = el.width();
    height = el.height();

    // make sure to use offset() and not position() as we want it relative to
    // the document, not its parent
    var offset = el.offset();
    return {width: width, height: height, xOffset: offset.left, yOffset: offset.top};
};
var oldMouseX, oldIndex;
function handleMouseOverGraph(event) {
    // this used to use graph.dimensions but that didn't get updated if they moved the window
    // I don't think initDimensions takes very long to run, so this probably shouldn't be too bad
    var dimensions = initDimensions(DOM.elevation);
    var mouseX = (event.type == "touchmove" ? (event.originalEvent.touches[0] || event.originalEvent.changedTouches[0]).pageX : event.pageX)
        - dimensions.xOffset - m[3];

    if(mouseX < 0)
        mouseX = 0;
    else if(mouseX > dimensions.width - m[3] - 5)
        mouseX = dimensions.width - m[3] - 5;

    if(oldMouseX !== mouseX) {
        oldMouseX = mouseX;
        var hoveredIndex = parseInt(x.invert(mouseX));
        
        hoverLineGroup.attr("transform", "translate("+mouseX+")");
        if(oldIndex !== hoveredIndex) {
            oldIndex = hoveredIndex;

            var val = elevationData[hoveredIndex];
            hoverLineTextValue.text(parseInt(val.e) + "m");
            moveMarker.setPosition(val.l);
        }
    }
}

var foreground, arc;
var arctext, arclabel;
var twoPi = Math.PI * 2;
function buildArcGauge(value, label, hoverValue, hoverMax, hoverLabel) {
    var width = 170,
    height = 170,
    radius = 70,
    normalColor = '#32978B',
    lowColor = '#c81322',
    secondaryColor = '#a1e8df',
    normalDuration = 750,
    fastDuration = 100;

    var svg = d3.select(DOM.arcgauge()[0])
        .append('svg')
        .attr('width', width)
        .attr('height', height)
          .append('g')
            .attr('transform', 'translate(' + (width / 2) + ',' + height / 2 + ')')
            .on('mouseover', function () { animateArc(hoverValue, hoverLabel, fastDuration, normalColor, hoverMax); })
            .on('touchstart', function () { animateArc(hoverValue, hoverLabel, fastDuration, normalColor, hoverMax); })
            .on('mouseleave', function (e) { animateArc(value, label, fastDuration, normalColor); })
            .on('touchend', function (e) { animateArc(value, label, fastDuration, normalColor); })
            .on('touchcancel', function (e) { animateArc(value, label, fastDuration, normalColor); });

    arc = d3.svg.arc()
      .innerRadius(radius-20)
      .outerRadius(radius);

    var meter = svg.append('g')
        .attr('class', 'arc-gauge');
      meter.append('path')  // background
        .datum({startAngle: 0, endAngle: twoPi})
        .style('fill', '#ddd')
        .attr('d', arc);
      meter.append('circle')
        .attr('r', radius - 20)
        .style('fill', 'white')
        .style('opacity', 0.1);

    arctext = meter.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .attr('class', 'digits')
        .style('pointer-events', 'none');

    if (label) {
        arclabel = meter.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '2.6em')
            .attr('class', 'arclabel')
            .style('pointer-events', 'none')
            .text(label);
    }

    var startAngle = 0;
    foreground = meter.append('path')
      .datum({ startAngle: startAngle, endAngle: startAngle })
      .attr('d', arc);

  animateArc(value, label, normalDuration, normalColor);
}
function animateArc(value, label, duration, fill, maxValue) {
    if(typeof(maxValue)==='undefined') maxValue = 100;
    arctext.text(value ? value : '--');
    arctext.classed("small", (value.toString().length > 2));
    arclabel.text(label);
    arclabel.attr('dy', label.length > 4 ? '3.3em' : '2.6em');
    arclabel.classed("small", label.length > 4);

    var endAngle = (value > 1 ? (value / maxValue) : value) * twoPi;

    foreground.transition().duration(duration)
        .attrTween('d', function (d) {
          var i = d3.interpolate(d.endAngle, endAngle);
          return function (t) {
            d.endAngle = i(t);
            foreground.style('fill', fill);
            return arc(d);
          };
        });
}
