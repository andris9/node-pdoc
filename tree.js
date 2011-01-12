var markdown = require("node-markdown").Markdown,
    utillib = require("util");
    
exports.parseTree = function(txt, fname, stairs){
    
    // js regex doesn't like dealing with multiple lines
    txt = txt.replace(/\n/g,"\u0000");
    txt.replace(/\/\*\*+(.*?)\*\*\//g, parserMain.bind(this, stairs, fname));
}

function parserMain(stairs, fname, original, lines){
    var block = {
        filename: fname.substr(fname.lastIndexOf('/')+1),
        pos: arguments[arguments.length-2]
    }, pos, parts, tags, fline, dline, r, steps, name, plist={};
    
    // remove asterisks
    lines = lines.replace(/\u0000\s*\*/g,"\u0000");

    // replace tabs with 4 spaces
    lines = lines.replace(/\t/,"    ");
    
    // normalize first line, tags
    fline = (pos = lines.indexOf("\u0000"))>-1?lines.substr(0, pos):"";
    lines = lines.substr(fline.length && fline.length+1 || 0);
    fline = fline.trim();
    
    tags = fline.split(",");
    block.tags = [];
    for(var i=0; i<block.tags.length; i++){
        tags[i] = block.tags[i].trim();
        if(tags[i].length){
            block.tags.push(tags[i]);
        }
    }
    
    // clear empty rows from the beginning
    lines = lines.replace(/^[\u0000\s]*\u0000(\s*[^\u0000\s])/,"$1");
    
    //normalize empty rows (clear whitespace)
    lines = lines.replace(/\u0000\s+\u0000/g,"\u0000\u0000");
    
    // find and remove steps (all lines indented by the definition line
    steps = lines.match(/^\s*/);
    steps = steps && steps.length && steps[0].length || 0;
    r = new RegExp("\u0000\\s{"+steps+"}","g");
    lines = lines.replace(r, "\u0000").trim();
    
    // definition line
    dline = (pos = lines.indexOf("\u0000"))>-1?lines.substr(0, pos):"";
    lines = lines.substr(dline.length && dline.length+1 || 0);
    dline = dline.trim();
    
    // find datatype
    parts = parseDataType(dline);
    block.datatype = parts[0];
    dline = parts[1];

    parts = dline.match(/\((.*?)\)/);
    if(!parts){
        if(!block.datatype){
            block.type = "namespace";
        }else{
            block.type = "value";
        }
    }else{
        if(!block.datatype){
            name = "new ";
            if(dline.substr(0,name.length)==name){
                block.type = "constructor";
                dline = dline.substr(name.length).trim();
            }else{
                block.type = "function";
            }
        }else{
            block.type = "function";
        }
        plist = parseParamList(parts[1])
    }
    
    // find name
    name = dline.match(/^[^(\s]*/);
    if(name && name.length){
        name = name[0].trim();
    }else name = "";
    
    if((pos = name.indexOf("#"))>-1){
        // instance method/property
        block.instance = true;
        block.name = name.substr(pos+1); 
        name = name.substr(0,pos);
    }else{
        if((pos = name.lastIndexOf("."))>-1){
            // object method//property
            block.name = name.substr(pos+1);
            name = name.substr(0, pos);
        }else{
            block.name = name;
            name = "";
        }
    }
    
    // find parents
    parseParents(name, block, stairs);
    
    // parse variable definitions
    lines = lines.trim();
    if(Object.keys(plist).length){
        parts = lines.split("\u0000\u0000");
        if(parts.length && parts[0].charAt(0)=="-"){
            block.params = parseParams(parts.shift(), plist);
            lines = parts.join("\u0000\u0000").trim();
        }
    }
    
    block.description = markdown(lines.replace(/\u0000/g,"\n"));
}

function parseParents(name, block, stairs){
    var cstairs = stairs, cname;
    if(name.length){
        block.ns = [];
        parts = name.split(".");
        
        // build stairs
        for(var i=0; i<parts.length; i++){
            cname = parts[i].trim();
            if(!(cname in cstairs)){
                cstairs[cname] = {
                    ___PDOCDATA: {
                        name: cname,
                        type: "namespace"
                    }
                };
            }
            cstairs = cstairs[cname];

            if(i<parts.length-1){
                block.ns.push(cname);
            }else{
                block.object = cname;
            }
        }
        
        if(!(block.name in cstairs)){
            cstairs[block.name] = {};
        }
        cstairs[block.name].___PDOCDATA = block;
    }else{
        if(!(block.name in cstairs)){
            cstairs[block.name] = {};
        }
        cstairs[block.name].___PDOCDATA = block;    
    }
}

function parseParams(paramblock, plist){
    var parts = paramblock.substr(1).split("\u0000-"), curr, list = [];
    
    for(var i=0; i<parts.length; i++){
        curr = parseParamRow(parts[i].trim(), plist);
        if(curr){
            list.push(curr);
        }
    }
    
    return list;
}

function parseParamRow(line, plist){
    var curr = {},
        parts = line.split(":"),
        name = parts.shift(),
        desc = parts.join(":"),
        datatype = "undefined",
        pos;
    
    curr.description = desc && desc.trim() || ""; 
    
    curr.description = markdown(curr.description.replace(/\u0000\s*/g,"\n"));
    
    name = name.replace(/\((.*)\)/, function(orig,type){
        datatype = type && type.trim() || "undefined";
        return "";
    }).trim();
    
    curr.name = name;
    curr.datatype = datatype.toLowerCase();
    
    curr.optional = !!(plist[curr.name] && !!plist[curr.name].optional);
    curr.defaultValue = plist[curr.name]?plist[curr.name].defaultValue:null;
   
    return curr;
}

function parseParamList(line){

    line = line.replace(/,/g," ");
    line = line.replace(/\]/g,"[");
    line = line.replace(/\s*\[+\s*/g," [");
    line = line.replace(/\[+\s*\[+/g," [");
    line = line.replace(/\s+/g," ");
    
    var parts = line.split(" "), plist = [], curr, cp;
    for(var i=0;i<parts.length; i++){
        curr = {};
        curr.name = parts[i].trim();
        if(curr.name.charAt(0)=="["){
            curr.optional = true;
        }
        curr.name = curr.name.replace(/[\[\]]*/,'').trim();
        
        cp = curr.name.split("=");
        if(cp.length>1){
            curr.name = cp.shift().trim();
            curr.defaultValue = cp.join("=").trim();
        }
        
        if(curr.name.length){
            plist[curr.name] = curr;
        }
    }

    return plist;
}

function parseDataType(line, sep){
    var parts, datatype;
    sep = sep || "->";
    
    if(line.indexOf(sep)<0){
        return [null, line];
    }
    
    parts = line.split(sep);
    if(parts.length>2){
        parts = [parts.pop(), parts.join(sep)].reverse();
    }
    
    datatype = parts[1] && parts[1].trim().toLowerCase() || "undefined";
    line = parts[0].trim();
    
    return [datatype, line];
}