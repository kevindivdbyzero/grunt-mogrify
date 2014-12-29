/*
 * grunt-mogrify
 */
'use strict';

module.exports = function( grunt ) {
    var moduleFS = require( 'fs' );
    var modulePath = require('path');

    grunt.registerMultiTask( 'mogrify', 'Convert, replace, transform, or occlude specific patterns in source code.', function () {

        var options = this.options( {
            transformations:    [],                             /*  An array of objects defining how the source should be transformed. */
            debug:              true,                           /*  Indicates whether or not diagnostic information should be displayed */
            inPlace:            false                           /*  If true, the transmogrification will be carried out in place and the destination file will be ignored */
        } );

        //  This originates from the copy task, and was inspired by outtaTime's grunt-replace task

        var dest;
        var isExpandedPair;

        var detectDestType = function(dest) {
            if (grunt.util._.endsWith(dest, '/')) {
                return 'directory';
            } else {
                return 'file';
            }
        };

        var unixifyPath = function (filepath) {
            if (process.platform === 'win32') {
                return filepath.replace(/\\/g, '/');
            } else {
                return filepath;
            }
        };

        var syncTimestamp = function (src, dest) {
            var stat = moduleFS.lstatSync(src);
            if (modulePath.basename(src) !== modulePath.basename(dest)) {
                return;
            }

            moduleFS.utimesSync(dest, stat.atime, stat.mtime);
        };

        /*  There is probably a better way to calculate the line number -- I just have no earthly idea what it might be. */
        var calculateLineNumber = function( text, offset ) {
            var ln = 1, length = Math.min( text.length, offset );
            for ( var i = 0; i < length; i++ ) {
                if ( text[i] === '\n' ) {
                    ln++;
                }
            }
            return ln;
        };

        var processMatch = function( fileContents, match, transformation, context ) {
            var replacement = "";
            if ( typeof transformation.replacement === 'string' ) {
                replacement = transformation.replacement;
            } else if ( typeof transformation.replacement === 'function' ) {
                context.line_number = calculateLineNumber( fileContents, match.index );
                replacement = transformation.replacement( match, context );
            }

            fileContents = fileContents.substring( 0, match.index ) + replacement + fileContents.substring( match.index + match[0].length );

            return fileContents;
        };

        var processFileCopy = function( fileContents, context ) {
            for ( var i = 0; i < options.transformations.length; i++ ) {
                var transformation = options.transformations[i];
                var type = transformation.type || "regex";

                switch( type ) {
                    case "regex" :
                        var pattern = transformation.pattern;
                        if ( pattern === undefined ) {
                            throw new Error("Mogrify usage error: transformation item " + i + " does not have a 'pattern' property." );
                        }
                        if ( typeof pattern === 'string' ) {
                            pattern = new RegExp( '/' + pattern + '/gm' );
                        }

                        var match = null;
                        while ( match = pattern.exec( fileContents ) ) {
                            fileContents = processMatch( fileContents, match, transformation, context );
                        }
                        break;
                    default :
                        throw new Error("Mogrify usage error: transformation item " + i + " has unknown type '" + type + "'" );
            }
            return fileContents;
        };

        this.files.forEach(function(filePair) {
            isExpandedPair = filePair.orig.expand || false;

            filePair.src.forEach(function(src) {
                if (detectDestType(filePair.dest) === 'directory') {
                    dest = (isExpandedPair) ? filePair.dest : unixifyPath(modulePath.join(filePair.dest, src));
                } else {
                    if ( options.inPlace ) {
                        dest = src;
                    } else {
                        dest = filePair.dest;
                    }
                }

                if (grunt.file.isDir(src)) {

                    grunt.file.mkdir(dest);

                    dirs[dest] = {
                        src: src,
                        dest: dest
                    };

                } else {

                    var context = {
                        sourceFile: src,
                        targetFile: dest
                    };

                    grunt.file.copy(src, dest, { process: processFileCopy } );

                    if ( ! options.inPlace ) {
                        syncTimestamp(src, dest);
                    }
                }
            });
        });

    } );

};
