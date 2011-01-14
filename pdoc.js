var fs = require("fs"),
    markdown = require("node-markdown").Markdown,
    utillib = require("util"),
    argv = require('optimist').argv,
    pathlib = require("path"),
    tree = require("./tree"),
    output = require("./output");

// read command line parameters
var include_dir = argv.include_dir || argv.i,
    output_file = argv.output_file || argv.o || "docs-"+Date.now()+".html",
    file_list = argv._;

/**
 * MAIN_TREE -> Object
 * 
 * Holds parsed documentation
 **/
var MAIN_TREE = {};

function resp(){
    console.log("ready");
    //console.log(JSON.stringify(MAIN_TREE));
    
    output.dump(MAIN_TREE, output_file, function(){
        console.log("DUMPED TO FILE!")
    });
    
}

if(include_dir){
    handleDir(include_dir, resp);
}

if(file_list.length){
    handleFiles(resp, '', null, file_list);
}

//////////////////////////////////////////////////////////////////

/**
 * handleDir(path, callback) -> undefined
 * - path (String): Directory path
 * - callback (Function): will be executed after function is finished
 * 
 * Finds all files from a directory and parses PDOC comments
 **/
function handleDir(path, callback){
    fs.readdir(path, handleFiles.bind(this, callback, path));
}

/**
 * handleFiles(callback, path, error, files) -> undefined
 * - callback (Function): will be executed when all files are parsed
 * - path (Function): direcotry path
 * - error (Error): error object when directory reading fails
 * - files (Array): list of files in a *path* directory
 * 
 * Takes a list of files and directories and tries to parse the documentation 
 **/
function handleFiles(callback, path, error, files){
    if(error)
        throw error;
    
    if(!files.length)
        return callback();
    
    var filename = pathlib.join(path, files.pop()),
        runback = function(){
            handleFiles(callback, path, null, files);
        }

    fs.stat(filename, function(error, stat){
        if(stat && stat.isDirectory()){
            handleDir(filename, runback);
        }else if(stat && filename.substr(filename.lastIndexOf(".")).toLowerCase()==".js"){
            parseFile(filename, runback);
        }else{
            runback();
        }
    });
}

/**
 * parseFile(fname, callback) -> undefined
 * - fname (String): filename
 **/
function parseFile(fname, callback){
    fs.readFile(fname, function(error, contents){
        if(error)
            throw error;
        
        contents = contents.toString("utf-8");
        tree.parseTree(contents, fname, MAIN_TREE);
        process.nextTick(callback);
    });
}


