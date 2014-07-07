var map, geocoder, bounds, markersArray;
var line, path;
var stops;

$(function() {
    // setup any images with magnific popup
     $(".imagepop").magnificPopup({type:"image"});

    // if there is a map div, setup the google maps api
    var mapDiv = $("#map");
    if(mapDiv.length > 0) {
        buildMap(mapDiv[0]);

        geocoder = new google.maps.Geocoder();
        bounds = new google.maps.LatLngBounds();
        markersArray = [];

        // if stops are defined, add markers and draw a line
        stops = mapDiv.data("stops");
        if(!!stops) {
            stops = _.filter(stops.split("|"), function(val) { return val.trim() != ""; });
            var flying = mapDiv.data("travelmode") == "Flying";
            
            if(stops.length > 0) {
                if(flying) {
                    drawLine(stops);
                    _.each(stops, function(element, index, list) {
                        console.log("adding marker for " + element);
                        addMarker(element);
                    });
                }
                else
                    getWalkingDirections(stops);
            }
        }
    }
});

function buildMap(mapElement) {
    // map style courtesy of snazzymaps.com
    var myOptions = {
        zoom: 7,
        center: new google.maps.LatLng(40.209269,-4.5302517),
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        streetViewControl: false,
        scrollwheel: false,
        styles:
        // SUBTLE MAP (http://snazzymaps.com/style/19/subtle)
        [{"featureType":"poi","stylers":[{"visibility":"off"}]},{"stylers":[{"saturation":-70},{"lightness":37},{"gamma":1.15}]},{"elementType":"labels","stylers":[{"gamma":0.26},{"visibility":"off"}]},{"featureType":"road","stylers":[{"lightness":0},{"saturation":0},{"hue":"#ffffff"},{"gamma":0}]},{"featureType":"road","elementType":"labels.text.stroke","stylers":[{"visibility":"off"}]},{"featureType":"road.arterial","elementType":"geometry","stylers":[{"lightness":20}]},{"featureType":"road.highway","elementType":"geometry","stylers":[{"lightness":50},{"saturation":0},{"hue":"#ffffff"}]},{"featureType":"administrative.province","stylers":[{"visibility":"on"},{"lightness":-50}]},{"featureType":"administrative.province","elementType":"labels.text.stroke","stylers":[{"visibility":"off"}]},{"featureType":"administrative.province","elementType":"labels.text","stylers":[{"lightness":20}]}]
    };
    map = new google.maps.Map(mapElement, myOptions);
}

function drawLine(stops) {
    line = new google.maps.Polyline({
        map: map,
        geodesic: true,
        strokeOpacity: 0,
        icons: [{
            offset: '0',
            repeat: '20px',
            icon: {
                path: 'M 0,-1 0,1',
                strokeOpacity: 1,
                strokeColor: '#E84813',
                scale: 4
            }
        }]
    });
    path = [];
}

function getWalkingDirections(stops) {
    var isHomepage = $(".home-map").length > 0;
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

function addMarker(location) {
    geocoder.geocode({'address': location}, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
            var latlng = results[0].geometry.location;
            bounds.extend(latlng);
            map.fitBounds(bounds);
            var marker = makeMarker(latlng);
                // icon: {
                //     path: fontawesome.markers.EXCLAMATION,
                //     scale: 0.5,
                //     strokeWeight: 0.2,
                //     strokeColor: 'black',
                //     strokeOpacity: 1,
                //     fillColor: '#f8ae5f',
                //     fillOpacity: 0.7
                // }
            markersArray.push(marker);

            // if drawing a line, update line now
            if(!!path && !!line) {
              var idx = _.indexOf(stops, location);
              path[idx] = latlng;
              if(path.length == stops.length && _.every(path, function(val) { return !!val; }))
                line.setPath(path);
            }
        } else {
          alert('Geocode was not successful for the following reason: '
            + status);
        }
    });
}
function makeMarker(position, title) {
    return new google.maps.Marker({
        map: map,
        position: position,
        title: title
    });
}

function getStats(response) {
    console.log(response);

    if(!!response.routes && response.routes.length > 0) {
        var legs = response.routes[0].legs;
        // add markers at start and end
        makeMarker(legs[0].start_location, "Start");
        if(legs.length > 1) {
            makeMarker(legs[0].end_location, "Current");
            makeMarker(legs[1].end_location, "End");
            showHomeStats(legs);
        } else {
            makeMarker(legs[0].end_location, "End");
            showDayStats(legs);
        }
    }
}

function showHomeStats(legs) {
    var stats = {
        Day: null,
        MilesTraveled: kmToMi(legs[0].distance.value),
        MilesLeft: kmToMi(legs[1].distance.value),
        DaysLeft: null,
        NeededPace: 1
    };

    var startDate = new Date(2014, 6, 3);
    var endDate = new Date(2014, 6, 30);
    var today = new Date();

    if(today < endDate) {
        var timeDiff = Math.abs(endDate.getTime() - today.getTime());
        var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24)); 
        stats.DaysLeft = diffDays;

        timeDiff = Math.abs(today.getTime() - startDate.getTime());
        diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24)); 
        stats.Day = diffDays;

        stats.NeededPace = parseFloat(stats.MilesLeft/stats.DaysLeft).toFixed(2);
        
        var template = _.template($('#statsTemplate').html());
        $("#stats").html(template({
            stats: stats
        }));
    }
}
function showDayStats(legs) {
    if(!legs || legs.length < 1)
        return;

    var stats = {
        MilesTraveled: kmToMi(legs[0].distance.value)
    };

    var template = _.template($('#statsTemplate').html());
    $("#stats").html(template({
        stats: stats
    }));
}

function kmToMi(val) {
    return parseFloat(val*0.000621371).toFixed(2);
}