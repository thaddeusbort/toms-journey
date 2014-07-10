list towns under map in some kind of staggered fashion
 clicking on town name, zooms in to that town and shows link to wikipedia or other site

save map data to post file so we don't have to retrieve it every time and can be assured it will stay the same
 save route as encoded polyline
 save distance as number
 save elevation data as something
when we don't have those properties defined, retrieve them and display a warning to copy to the post file


-rework map code
 -if post
  -if travel-mode == flying
   -create a line and add markers for each location and add them to the line's path
  -otherwise
   -if path variable not defined
    -get walking directions display encoded polyline on page to copy
    -manually copy and paste the polyline to the path variable for the post
   -otherwise
    -create a polyline on the map using the decoded path variable
    -add markers for each town
     -set bounds from the markers
    -get elevation for each point and create a elevation graph below map
     -move mouse over graph to move indicator along path on map
 -if homepage
  -add all polylines from posts to make a long path
  -add up mileage
  -add markers for each town
  -add indicators for where each day started
  -add indicator for finish line
  -get elevation


