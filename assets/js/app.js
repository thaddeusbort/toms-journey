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
                if(flying)
                    drawLine(stops);
                else
                    getWalkingDirections(stops);

                _.each(stops, function(element, index, list) {
                    console.log("adding marker for " + element);
                    addMarker(element);
                });

                if(!flying)
                    getStats();
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
    var origin = stops[0];
    var destination = stops[stops.length-1];

    var directionsDisplay = new google.maps.DirectionsRenderer();
    var directionsService = new google.maps.DirectionsService();
    directionsDisplay.setMap(map);
    var request = {
        origin: origin,
        destination: destination,
        travelMode: google.maps.TravelMode.WALKING
    };
    directionsService.route(request, function(response, status) {
        if (status == google.maps.DirectionsStatus.OK) {
            directionsDisplay.setDirections(response);
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
            var marker = new google.maps.Marker({
                map: map,
                position: latlng
            });
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

function getStats() {
    var origin = stops[0];

    var service = new google.maps.DistanceMatrixService();
    service.getDistanceMatrix(
    {
        origins: [origin],
        destinations: stops,
        travelMode: google.maps.TravelMode.WALKING,
        unitSystem: google.maps.UnitSystem.IMPERIAL
    }, function(response, status) {
        console.log(response);
        console.log(status);
        if(status !== "OK")
            return console.log("Problem getting distance!");

        if(!!response.rows && response.rows.length > 0) {
            var results = response.rows[0].elements;
            if($("#homewrap").length > 0)
                showHomeStats(results)
            else
                showDayStats(results);
        }
    });
}

function showHomeStats(results) {
    var stats = {
        Day: null,
        MilesTraveled: null,
        MilesLeft: null,
        DaysLeft: null,
        NeededPace: 1
    };

    var distanceTraveled = 0;
    var totalDistance = 0;
    _.each(results, function(element, index, list) {
        if(index < list.length-1)
            distanceTraveled += element.distance.value;
        else
            totalDistance = element.distance.value;
    });
    stats.MilesTraveled = parseFloat(distanceTraveled*0.000621371).toFixed(2);
    stats.MilesLeft = parseFloat(totalDistance*0.000621371).toFixed(2);

    var startDate = new Date(2014, 6, 2);
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
    }
    var template = _.template($('#statsTemplate').html());
    $("#stats").html(template({
        stats: stats
    }));
}
function showDayStats(results) {
    var stats = {
        MilesTraveled: null,
    };

    var distanceTraveled = 0;
    _.each(results, function(element, index, list) {
        distanceTraveled += element.distance.value;
    });
    stats.MilesTraveled = parseFloat(distanceTraveled*0.000621371).toFixed(2);

    var template = _.template($('#statsTemplate').html());
    $("#stats").html(template({
        stats: stats
    }));
}