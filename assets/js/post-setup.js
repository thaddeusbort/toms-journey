// THIS IS ONLY TO BE INCLUDED WHEN RUNNING LOCALLY
//  IT WILL HELP RETRIEVE DATA THAT CAN THEN BE SAVED INTO THE POST FILES
//  TO REMOVE THE NEED TO CALL THE SERVICES EVERYTIME AND TO GUARANTEE
//  THE DATA STAYS THE SAME

$(function() {
    if(!postData) {
        if(typeof(towns) == "undefined" || !towns || towns.length == 0)
            alert("towns must be defined in the markdown");
        else
            getWalkingRoute(towns);
    }
});

var saveData;
function getWalkingRoute(towns) {
    var origin = _.first(towns);
    var destination = _.last(towns);
    var waypoints = _.map(_.initial(_.last(towns, towns.length-1))
        , function(val) { return {
            location: val,
            stopover: false
        }
    });
    if(waypoints.length > 8) {
        console.log("Too many waypoints specified, reducing to prevent Google Maps error.");
        waypoints = _.last(waypoints, 8);
    }

    var directionsService = new google.maps.DirectionsService();
    var request = {
        origin: origin,
        destination: destination,
        waypoints: waypoints,
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.WALKING
    };
    directionsService.route(request, function(response, status) {
        if (status != google.maps.DirectionsStatus.OK) {
            console.log("Error getting route");
            console.log(response);
        } else {
            // handle directions response
            if(!!response.routes && response.routes.length > 0) {
                var route = response.routes[0];

                var elevator = new google.maps.ElevationService();
                elevator.getElevationAlongPath({
                    path: route.overview_path,
                    samples: 100
                }, function(results, status) {
                    console.log(route);
                    saveData = {
                        mileage: kmToMi(route.legs[0].distance.value),
                        polyline: route.overview_polyline,
                        elevation: JSON.stringify(_.map(results, function(val) { return { e:parseInt(val.elevation), l: { lat:val.location.k, lng:val.location.B }}})),
                        geocodes: {}
                    }
                    
                    // geocode all towns so we can save
                    var geocoder = new google.maps.Geocoder();
                    geocode(geocoder, 0);
                });
            }
        }
    });
}

function geocode(geocoder, index) {
    var town = towns[index];
    geocoder.geocode({'address': town}, function(results, status) {
        if (status != google.maps.GeocoderStatus.OK) {
            console.log(status);
            return alert("Error geocoding!");
        }
        var latlng = results[0].geometry.location;
        saveData.geocodes[town] = latlng;

        if(Object.keys(saveData.geocodes).length == towns.length && _.every(saveData.geocodes, function(val) { return !!val; }))
            outputData();
        else
            setTimeout(function() { geocode(geocoder, ++index)}, 500);
    });
}

function outputData() {
    // output the route and elevation data so we can save it to the post file
    var output = "\
data:\r\n\
 mileage: " + saveData.mileage + "\r\n\
 towns:\r\n"
 + townsYaml(towns) + "\
 polyline: " + saveData.polyline + "\r\n\
 elevation: " + saveData.elevation;

    DOM.map.before("<div class='alert alert-warning' role='alert'><textarea style='width:100%;height:300px;'>" + output + "</textarea></div>");
    alert("Copy the data below to the appropriate post file.")
}

function kmToMi(val) {
    return parseFloat(val*0.000621371).toFixed(2);
}

function townsYaml(towns) {
    var output = "";
    _.each(towns, function(town, index, list) {
        output += "\
  - name: " + town + "\r\n\
    url: http://en.wikipedia.org/wiki/" + town.split(",")[0].replace(/\s/g,"_") + "\r\n\
    gps:\r\n\
     lat: " + saveData.geocodes[town].k + "\r\n\
     lng: " + saveData.geocodes[town].B + "\r\n";
    });
    return output;
}
