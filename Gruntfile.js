module.exports = function(grunt) {

grunt.initConfig({
  exec: {
    build: {
      cmd: 'jekyll build'
    },
    serve: {
      cmd: "jekyll serve --watch --baseurl=''"
    },
    deploy: {
      cmd: 'echo This is hosted on GitHub Pages. Push to deploy.'
    }
  }
});

grunt.loadNpmTasks('grunt-exec');

grunt.registerTask('default', [ 'exec:serve' ]);
grunt.registerTask('serve', [ 'exec:serve' ]);
grunt.registerTask('deploy', [ 'exec:deploy' ]);

};