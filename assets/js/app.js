var map, bounds, markerArray, infowindow;
var isHomepage = $(".home-map").length > 0;

var dottedLine = [{ offset: "0", repeat: "10px", icon: { path: "M 0,0 0,0.1", strokeOpacity: 1, strokeColor: "#335599", scale: 4 }}];
var dashedLine = [{ offset: "0", repeat: "20px", icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: "#E84813", scale: 4 }}];

var icons = {
    start: assetsPath + "img/marker_start.png",
    stop: assetsPath + "img/marker_stop.png",
    santiago: assetsPath + "img/marker_santiago.png",
    town: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 5
    }
}

var DOM = {
    imgpop: $(".imagepop"),
    iframepop: $("a.pop"),
    map: $("#map"),
    maplabel: $("#map-label"),
    elevation: $("#elevation-container"),
    arcgauge: function() { return $(".arcgauge"); }
};
        
$(function() {
    // setup any images with magnific popup
    DOM.imgpop.magnificPopup({type:"image"});
    setupMagnificIframe(DOM.iframepop);

     // setup any single page nav links
    var single_page_nav = $(".single-page-nav");
    if(!!single_page_nav && single_page_nav.length > 0)
        single_page_nav.singlePageNav({
            offset: 50,
            filter: $("a[href^='#'"),
            currentClass: "active"
        });

    if(!postData)
        return;

    var santiago_location = { lat: 42.8802049, lng: -8.5447697 };
    // if there is a map div, setup the google maps api
    if(DOM.map.length > 0) {
        map = buildMap(DOM.map[0]);

        bounds = new google.maps.LatLngBounds();

        if(isHomepage) {
            // TODO: any parsing that needs to be done to make postData object usable
        }

        if(postData.flights) {
            // if flights are defined, add markers and draw a geodesic line between them
            var line = drawLine(map, null, dashedLine, true);
            var path = [];
            var geocoder = new google.maps.Geocoder();
            _.each(postData.flights, function(flight, index, list) {
                addMarker(geocoder, flight, path, line);
            });
        } else {
            if(!postData.paths)
                postData.paths = [postData.polyline];

            // draw route paths
            _.each(postData.paths, function(path, index, list) {
                if(path.indexOf('ESCAPE') == 0)
                    path = path.substring(6);
                var decodedPath = google.maps.geometry.encoding.decodePath(path);
                drawLine(map, decodedPath);
            });

            // add start and end icons
            moveMarker = makeMarker(_.first(postData.towns).gps, null, icons.start);
            if(isHomepage)
                makeMarker(santiago_location, null, icons.santiago);
            else {
                var lastTown = _.last(postData.towns);
                var isSantiago = lastTown.name.indexOf("Santiago de Compostela") == 0;
                makeMarker(lastTown.gps, null
                    , isSantiago ? icons.santiago : icons.stop);
            }

            buildElevationGraph();

            infowindow = new google.maps.InfoWindow();
            markerArray = [];
            if(isHomepage) {
                var endDate = new Date(2014, 6, 25);

                if(postData.lastCheckin < endDate && !!postData.mileage && postData.mileage > 0) {
                    var TOTAL_MILES = 478;
                    var TOTAL_DAYS = 23;
                    var timeDiff = Math.abs(endDate.getTime() - postData.lastCheckin.getTime());
                    var daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
                    var daysUsed = TOTAL_DAYS - daysLeft;

                    var model = {
                        milesTraveled: parseInt(postData.mileage),
                        milesLeft: parseInt(TOTAL_MILES-postData.mileage),
                        percentTraveled: parseInt((postData.mileage/TOTAL_MILES)*100),
                        percentDays: parseInt((daysUsed/TOTAL_DAYS)*100),
                        daysLeft: daysLeft,
                        maxElevation: _.max(_.pluck(postData.elevation, "e"))
                    };
                    model.neededPace = parseFloat(model.milesLeft/daysLeft).toFixed(1).replace(".0", "");
                    useTemplate("statsTemplate", "stats", model);

                    buildArcGauge(model.percentTraveled, "% traveled", daysUsed, TOTAL_DAYS, "days walking");
                }

                // draw circles for each starting town
                _.each(homeData, function(hdo, index, list) {
                    if(!!hdo.towns && hdo.towns.length > 0) {
                        var town = _.last(hdo.towns);
                        var marker = makeMarker(town.gps, null, icons.town);
                        google.maps.event.addListener(marker, "mouseover", function() { showMarkerDetails(marker, false, false, hdo.title, hdo.url); });
                        google.maps.event.addListener(marker, "mouseout", function() { showMarkerDetails(marker, false, true); });
                        google.maps.event.addListener(marker, "click", function() { showMarkerDetails(marker, true, false, hdo.title, hdo.url); });
                        markerArray.push(marker);
                    }
                });
            } else {
                // draw circles for each town
                _.each(postData.towns, function(town, index, list) {
                    var marker = makeMarker(town.gps, null, icons.town);
                    google.maps.event.addListener(marker, "mouseover", function() { showMarkerDetails(marker); });
                    google.maps.event.addListener(marker, "mouseout", function() { showMarkerDetails(marker, false, true); });
                    google.maps.event.addListener(marker, "click", function() { showMarkerDetails(marker, true); });
                    markerArray.push(marker);
                });
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

function drawLine(map, path, lineStyle, geodesic) {
    if(typeof(geodesic)==="undefined") geodesic = false;
    if(typeof(lineStyle)==="undefined") lineStyle = dottedLine;
    if(!path) path = [];

    return new google.maps.Polyline({
        map: map,
        path: path,
        geodesic: geodesic,
        strokeOpacity: 0,
        icons: lineStyle
    });
}

function addMarker(geocoder, location, path, line) {
    var marker = makeMarker(); // empty marker, set location below
    geocoder.geocode({"address": location}, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
            var latlng = results[0].geometry.location;
            bounds.extend(latlng);
            map.fitBounds(bounds);
            marker.setPosition(latlng);

            // if drawing a line between markers, update line now
            if(!!path && !!line) {
                var idx = _.indexOf(postData.flights, location);
                path[idx] = latlng;
                if(path.length == postData.flights.length && _.every(path, function(val) { return !!val; })) {
                    line.setPath(path);
                    map.panBy(0, -50);
                }
            }
        } else {
          alert("Geocode was not successful for the following reason: " + status);
        }
    });
    return marker;
}
function makeMarker(position, title, icon) {
    if(!!position) {
        var latlng = new google.maps.LatLng(position.lat, position.lng);
        bounds.extend(latlng);
        map.fitBounds(bounds);
    }
    return new google.maps.Marker({
        map: map,
        position: position,
        title: title,
        icon: icon
    });
}

//$(DOM.map).on("mousemove touchmove", function(event) { setMarkerVisibility(true); });
//$(DOM.map).on("mouseleave touchend touchcancel", function(event) { setMarkerVisibility(false); });
function setMarkerVisibility(visibility) {
    if(!!markerArray) {
        _.each(markerArray, function(marker, index, list) {
            marker.setVisible(visibility);
        });
    }
}
function showMarkerDetails(marker, zoom, hide, title, url) {
    var position = marker.getPosition();
    var town = _.find(postData.towns, function(val) { return val.gps.lat == position.k && val.gps.lng == position.B; });
    if(!!town) {
        var name = !!title ? title : town.name.replace(", Spain", "");
        DOM.maplabel.text(name);
        DOM.maplabel.toggleClass("hide", hide);
        if(zoom) {
            map.setZoom(12);
            map.panTo(position);
            
            var model = {
                name: !!title ? title : town.name,
                url: !!url ? url : town.url,
                isexternal: !title
            }
            var content = useTemplate("markerTemplate", null, model);
            infowindow.setContent(content);
            infowindow.open(map, marker);
            if(model.isexternal)
                setupMagnificIframe($("#map-info-window a.pop"));
        }
    }
}

function useTemplate(templateId, containerId, model) {
    var template = _.template($("#" + templateId).html());
    var output =  template({
        model: model
    });
    if(!!containerId)
        $("#" + containerId).html(output);
    else
        return output;
}

var m = [0,0,0,15];
var graph, moveMarker;
function buildElevationGraph() {
    var el = DOM.elevation;
    var width = el.width()-m[1]-m[3];
    var height = 150;

    var chart = $("#elevation", el)[0];
    var yaxis = $("#y_axis", el)[0];
    
    var rdata = _.map(postData.elevation, function(val, idx) { return { x: idx, y: val.e }; });
    
    graph = new Rickshaw.Graph({
        element: chart,
        width: width,
        height: height,
        series: [{
            color: 'steelblue',
            data: rdata
        }]
    });

    var y_axis = new Rickshaw.Graph.Axis.Y({
        graph: graph,
        orientation: 'left',
        tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
        element: yaxis
    });

    graph.render();

    // Add a y-axis label.
     var label = d3.select("#elevation svg")
        .append("text")
         .attr("class", "y label")
         .attr("text-anchor", "end")
         .attr("y", 6)
         .attr("dy", ".75em")
         .attr("transform", "rotate(-90)")
         .text("elevation (meters)");

    var CustomHover = Rickshaw.Class.create(Rickshaw.Graph.HoverDetail, {
        render: function($super, args) {
            $super(args);

            var val = postData.elevation[args.domainX];
            moveMarker.setPosition(val.l);
        },
        _addListeners: function($super) {
            $super();

            this.graph.element.addEventListener(
                'touchmove',
                function(e) {
                    // TODO: if movement is mostly in y-direction, don't prevent default and let the user scroll
                    e.preventDefault();
                    this.visible = true;
                    var dimensions = initDimensions(DOM.elevation);
                    var touchPoint = (e.touches[0] || e.changedTouches[0]);
                    e.offsetX = touchPoint.pageX - dimensions.xOffset - m[3];
                    e.offsetY = touchPoint.pageY;
                    this.update(e);
                }.bind(this),
                false
            );
            this.graph.element.addEventListener('touchend', function(e) { mouseOutGraph(e, this) }.bind(this), false);
            this.graph.element.addEventListener('touchcancel', function(e) { mouseOutGraph(e, this) }.bind(this), false);
            this.graph.element.addEventListener('mouseleave', function(e) { mouseOutGraph(e, this) }.bind(this), false);
        }
    });

    var hoverDetail = new CustomHover({
        graph: graph,
        formatter: function(series, x, y) {
            return y + "m";
        }
    });
}

function mouseOutGraph(e, hoverDetail, force) {
    //if (force || (e.relatedTarget && !(e.relatedTarget.compareDocumentPosition(hoverDetail.graph.element) & Node.DOCUMENT_POSITION_CONTAINS))) {
        moveMarker.setPosition(postData.elevation[0].l);
        hoverDetail.hide();
    //}
}

$(window).on("resize", function() { redrawElevationGraph(); });
function redrawElevationGraph() {
    if(postData) {
        var el = DOM.elevation;
        var width = el.width()-m[1]-m[3];
        var height = 150;

        graph.configure({ width:width, height:height });
        graph.render();
    }
}

var initDimensions = function(el) {
    // automatically size to the container using JQuery to get width/height
    width = el.width();
    height = el.height();

    // make sure to use offset() and not position() as we want it relative to
    // the document, not its parent
    var offset = el.offset();
    return {width: width, height: height, xOffset: offset.left, yOffset: offset.top};
};

var foreground, arc;
var arctext, arclabel;
var twoPi = Math.PI * 2;
function buildArcGauge(value, label, hoverValue, hoverMax, hoverLabel) {
    var width = 170,
    height = 170,
    radius = 70,
    normalColor = "#32978B",
    lowColor = "#c81322",
    secondaryColor = "#a1e8df",
    normalDuration = 750,
    fastDuration = 100;

    var svg = d3.select(DOM.arcgauge()[0])
        .append("svg")
        .attr("width", width)
        .attr("height", height)
          .append("g")
            .attr("transform", "translate(" + (width / 2) + "," + height / 2 + ")")
            .on("mouseover", function () { animateArc(hoverValue, hoverLabel, fastDuration, normalColor, hoverMax); })
            .on("mousedown", function () { animateArc(hoverValue, hoverLabel, fastDuration, normalColor, hoverMax); })
            .on("mouseleave", function (e) { animateArc(value, label, fastDuration, normalColor); })
            .on("mouseup", function (e) { animateArc(value, label, fastDuration, normalColor); });

    arc = d3.svg.arc()
      .innerRadius(radius-20)
      .outerRadius(radius);

    var meter = svg.append("g")
        .attr("class", "arc-gauge");
      meter.append("path")  // background
        .datum({startAngle: 0, endAngle: twoPi})
        .style("fill", "#ddd")
        .attr("d", arc);
      meter.append("circle")
        .attr("r", radius - 20)
        .style("fill", "white")
        .style("opacity", 0.1);

    arctext = meter.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", ".35em")
        .attr("class", "digits")
        .style("pointer-events", "none");

    if (label) {
        arclabel = meter.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "2.6em")
            .attr("class", "arclabel")
            .style("pointer-events", "none")
            .text(label);
    }

    var startAngle = 0;
    foreground = meter.append("path")
      .datum({ startAngle: startAngle, endAngle: startAngle })
      .attr("d", arc);

  animateArc(value, label, normalDuration, normalColor);
}
function animateArc(value, label, duration, fill, maxValue) {
    if(typeof(maxValue)==="undefined") maxValue = 100;
    arctext.text(value ? value : "--");
    arctext.classed("small", (value.toString().length > 2));
    arclabel.text(label);
    arclabel.attr("dy", label.length > 4 ? "3.3em" : "2.6em");
    arclabel.classed("small", label.length > 4);

    var endAngle = (value > 1 ? (value / maxValue) : value) * twoPi;

    foreground.transition().duration(duration)
        .attrTween("d", function (d) {
          var i = d3.interpolate(d.endAngle, endAngle);
          return function (t) {
            d.endAngle = i(t);
            foreground.style("fill", fill);
            return arc(d);
          };
        });
}

function setupMagnificIframe(elements) {
    elements.magnificPopup({
        type:"iframe",
        iframe: {
            patterns: {
                customsource: {
                    index: "",
                    src: "%id%"
                }
            }
        }
     });
}