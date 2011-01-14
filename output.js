var fs = require("fs");

exports.dump = function(contents, fname, callback){
    fs.readFile("template.html", function(error, template){
        if(error)
            throw error;
        
        template = new Template(template.toString("utf-8"));
        
        template.update("title","PDOC");

        var linear_list = [], gencount = 0;

        function walk(object, nodenr, depth){
            nodenr = nodenr || 0;
            depth = depth || 2;
            if(depth>6)depth=6;
            
            var keys = Object.keys(object).sort(function(a, b){
                    var c = object[a] && object[a].___PDOCDATA && object[a].___PDOCDATA.name,
                        d = object[b] && object[b].___PDOCDATA && object[b].___PDOCDATA.name;                    
                    return (c && c.toLowerCase()) > (d && d.toLowerCase())?1:-1;
                }),
                toc,
                elm,
                list = [],
                maintoc = template.get("maintoc"),
                c = 1;

            for(var i=0; i<keys.length; i++){
                
                if(keys[i]=="___PDOCDATA")
                    continue;
            
                elm = object[keys[i]];
                if(!elm || !elm.___PDOCDATA)
                    continue;
            
                toc = template.get("toc");
                
                elm.___PDOCDATA.paramStr = genParamList(elm);
                toc.update("toctitle", elm.___PDOCDATA.name + elm.___PDOCDATA.paramStr);
                
                elm.___PDOCDATA.nr = (nodenr && nodenr+"." || "")+c++;
                elm.___PDOCDATA.depth = depth;
                
                elm.___PDOCDATA.nr_nr = gencount++;
                
                
                toc.update("tocnr", elm.___PDOCDATA.nr+".");
                toc.update("tocurl", "#node-"+elm.___PDOCDATA.nr);
                
                if(Object.keys(elm).length>1){
                    toc.update("tocsub", walk(elm, elm.___PDOCDATA.nr, depth+1));
                }else
                    toc.update("tocsub", "");

                linear_list.push(elm.___PDOCDATA);

                list.push(toc.generate());
            }
            maintoc.update("toclist", list.join("\n"));
            return maintoc.generate();
        }
        
        template.update("toc", walk(contents));
        
        linear_list = linear_list.sort(function(a, b){
           return a.nr_nr>b.nr_nr?1:-1; 
        });
        
        var elm, title, params=[], mptpl, ptpl, tmp, plist;
        for(var i=0; i<linear_list.length; i++){
            mptpl = template.get("mainparam");
            elm = template.get("element");
            elm.update("elmh", linear_list[i].depth);
            elm.update("elmurl", "node-"+linear_list[i].nr);
            
            elm.update("elmname", linear_list[i].nr+". "+linear_list[i].name);
            
            title = '<span class="methodname">'+linear_list[i].name+'</span>' + linear_list[i].paramStr;
            if(linear_list[i].datatype){
                title += " → "+linear_list[i].datatype;
            }
            
            if(linear_list[i].params){
                plist = [];
                for(var j=0; j<linear_list[i].params.length; j++){
                   ptpl = template.get("param");
                   ptpl.update("paramname",linear_list[i].params[j].name);
                   ptpl.update("paramtype",linear_list[i].params[j].datatype);
                   ptpl.update("paramdesc",linear_list[i].params[j].description);
                   
                   tmp = [];
                   if(linear_list[i].params[j].optional){
                       tmp.push("optional");
                   }
                   
                   if(typeof linear_list[i].params[j].defaultValue!="undefined"){
                       tmp.push("defaults to "+linear_list[i].params[j].defaultValue);
                   }
                   
                   ptpl.update("paramset",tmp.join(""));
                   plist.push(ptpl.generate());
               
               }
               mptpl.update("params", plist.join(""));
               elm.update("params", mptpl.generate());
            }else{
                elm.update("params", "");
            }
            
            elm.update("elmtitle", title);
            elm.update("elmdesc", linear_list[i].description || '');
            elm.update("elmfile", linear_list[i].filename && "- "+linear_list[i].filename || '');
            
            template.unshift("elements", elm.generate());
        }
        
        template.update("elements","");
        
        fs.writeFile(fname, template.generate(), function(error){
            if(error)
                throw error;
            callback();
        });
    });
}

function genParamList(elm){
    var params = [], param, curr;
    if(!elm || !elm.___PDOCDATA || !(elm.___PDOCDATA.params || elm.___PDOCDATA.type=="function"))
        return "";
    
    for(var i=0; i<(elm.___PDOCDATA.params || []).length; i++){
        param = elm.___PDOCDATA.params[i];
        curr = param.name;
        if(typeof param.defaultValue!="undefined"){
            curr+=" = "+param.defaultValue;
        }
        if(param.optional){
            curr="["+curr+"]";
        }
        if(i>0){
            if(param.optional){
                curr = "[, "+curr.substr(1);
            }else
                curr = ", "+curr;
        }
        params.push(curr);
    }
    return "("+params.join("")+")";
}

function Template(tmpl){
    this.template = tmpl;
    this.data = {};
}

Template.prototype.update = function(name, value){
    var r = new RegExp("\\{\\{"+name+"\\}\\}", "g");
    this.template = this.template.replace(r, value);
}

Template.prototype.unshift = function(name, value){
    var r = new RegExp("\\{\\{"+name+"\\}\\}", "g");
    this.template = this.template.replace(r, value+"{{"+name+"}}");
}

Template.prototype.get = function(name){
    if(this.data[name]){
        return new Template(this.data[name]);
    }else{
        var r = new RegExp("\\{%"+name+"%\\}(.*?){%\\/"+name+"%\\}"),
            t = this.template.replace(/\n/g,"\u0000").match(r);
        this.data[name] = t && t.length>1 && t[1].replace(/\u0000/g,"\n") || "";
        return new Template(this.data[name]);
    }
}

Template.prototype.generate = function(){
    return this.template.replace(/\n/g,"\u0000").
        replace(/\{%(.*?)%\}(.*?){%\/\1%\}/g,'').
        replace(/\u0000/g,"\n");
}


