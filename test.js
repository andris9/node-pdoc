var mongo = require('mongodb'),
    config = require('./config').config,
    tools = require('./tools'),
    difftool = require('./diff');

/**
 * exports.db_connection -> Object
 * 
 * Hoiab endas viidet andmebaasiühenduse juurde. Saab tekitada
 * funktsiooniga open_db
 **/
exports.db_connection = false;

/**
 * FLYCOM
 * 
 * Üldine nimeruum
 **/

/**
 * new FLYCOM.PKRegcodeFactory()
 * 
 * Automaatsete registrikoodide generaator - juhul kui vaikimisi registrikood
 * on seadmata, luuakse kirje salvestamisel automaatselt uus, mis on
 * kaheksakohaline number kujul 9 + päeva number + kaunter + juhuslik arv
 * 
 **/
var PKRegcodeFactory = function() {}
PKRegcodeFactory.counter = 0;
PKRegcodeFactory.prototype = new Object();

/**
 * FLYCOM.PKRegcodeFactory#createPk() -> String
 * 
 * Genereerib võtme
 * 
 **/
PKRegcodeFactory.createPk = function() {
    var d = new Date(), 
        key = "" + d.getDate() + (++PKRegcodeFactory.counter),
        rnd = String(Math.floor(Math.random() * Math.pow(10, 7-key.length)));
    tools.log(key)
    key = "9" + key + rnd;
    while(key.length<8)key += "0";
    return key;
}

/*
 * Määrab ära ühenduse seaded ja salvestab need muutujasse db
 */
var db = new mongo.Db(
    config.db.name, // db name 
    new mongo.Server(
        config.db.host, // server 
        config.db.port || mongo.Connection.DEFAULT_PORT, //port
        {auto_reconnect: true}
    ), {pk:PKRegcodeFactory});

var db_open_queue = [];
open_db(function(){}, function(){});

/**
 * open_db(callback, error_callback) -> undefined
 * - callback (Function): funktsioon mis käivitada peale andmebaasi avamist
 * - error_callback (Function): käivita kui avamine ei õnnestunud
 * 
 * Avab andmebaasi toiminguteks ja salvestab pointeri muutujasse
 * exports.db_connection
 **/
function open_db(callback, error_callback){
    tools.log("OPEN DB");
    if(db_open_queue.length){
        db_open_queue.unshift([callback, error_callback]);
        return;
    }
    db_open_queue.unshift([callback, error_callback]);
    db.open(function(error, db){
        if(error){
            tools.log("DB ERROR");
            tools.log(error);
            while(db_open_queue.length){
                db_open_queue.pop()[1](error, null);
            }
            error_callback(error, null);
        }
        tools.log("DB OPEN OK");
        exports.db_connection = db;
        while(db_open_queue.length){
            db_open_queue.pop()[0]();
        }
    });
}

/**
 * createCollection(callback) -> undefined
 * - callback (Function): tagasikutsefunktsioon
 * 
 * Loob andmebaasi kontaktinfo tabeli
 **/
exports.createCollection = function(callback){
    if(!exports.db_connection){
        return open_db(exports.createCollection.bind(exports, callback), callback);
    }
    db.createCollection(config.db.tablename, callback);
}

/**
 * exports.save(data, callback) -> undefined
 * - data (Object): Salvestatavad andmed
 * - callback (Function): käivitatakse kui on error või salvestamine õnnestub
 *   parameetriteks error, data
 *   
 * Salvestab andmed baasi ja tagastab salvestatud objekti
 **/
exports.save = function(data, callback){
    if(!exports.db_connection){
        return open_db(exports.save.bind(exports, data, callback), callback);
    }
    
    var doc = {
        data: data,
        updated: new Date(),
        created: new Date()
    }, diff;
    
    // määra ID, kui pole (väärtus on a) lisatakse automaatselt
    if(data.org && data.org.regcode && String(data.org.regcode).trim() != "a")
        doc._id = String(data.org.regcode);
    else{
        doc._id = PKRegcodeFactory.createPk();
        if(doc.data.org){
            doc.data.org.regcode = doc._id.toString();
        }
    }
    
    // Ava tabel
    tools.log(config.db.tablename)
    db.createCollection(config.db.tablename, function(error, collection){
        if(error){
            tools.log("COLLECTION ERROR")
            tools.log(error);
            return callback(error, null);
        }
        tools.log("COLLECTION SELECT OK");
        
        exports.load(doc._id, function(error, old_doc){
            
            if(error){
                tools.log("LOAD ERROR")
                tools.log(error);
                return callback(error, null);
            }
            
            if(old_doc){
                tools.log("UPDATE")
                // leia diff
                diff = difftool.findBizinfoDiff(old_doc, data);
                // salvesta vanem versioon faili
                tools.dumpOldVersion(old_doc);
                
                collection.update({_id: doc._id}, {
                    "$set":{
                        data:data,
                        updated:doc.updated
                     }
                }, function(error, docs){
                    if(error){
                        tools.log("UPDATE ERROR")
                        tools.log(error);
                        return callback(error, null);
                    }
                    tools.log("UPDATE DOCUMENT OK")

                    exports.load(doc._id, function(error, success){
                        callback(error, success, diff);
                    });
                });
            }else{
                tools.log("INSERT")
                collection.insert(doc, function(error, docs){
                    if(error){
                        tools.log("INSERT ERROR")
                        tools.log(error);
                        return callback(error, null);
                    }
                    tools.log("INSERT DOCUMENT OK")

                    exports.load(doc._id, function(error, success){
                        callback(error, success, ["Inserted "+data.org.regcode]);
                    });
                });
            }

        })
        
    });
}

/**
 * exports.load(regcode, callback) -> undefined
 * - regcode (String): registrikood, mille alusel otsida
 * - callback (Function): käivitatakse kui tekkis viga või leiti. Juhul
 *   kui andmeid ei leitud, on väärtuseks null
 *   
 * Otsib andmebaasist üles registrikoodiga kirje
 **/
exports.load = function(regcode, callback){
    if(!exports.db_connection){
        return open_db(exports.load.bind(exports, regcode, callback), callback);
    }
    
    // Ava tabel
    db.createCollection(config.db.tablename, function(error, collection){
        if(error){
            tools.log("COLLECTION ERROR")
            tools.log(error);
            return callback(error, null);
        }
        tools.log("COLLECTION SELECT OK");
        
        // Otsi element baasist üles
        tools.log(regcode)
        //new db_connection.bson_serializer.ObjectID(regcode.toString())
        collection.find({"_id": regcode}, function(error, cursor) {
           if(error){
               tools.log("FIND ERROR")
               tools.log(error);
               return callback(error, null);
           }
           
           tools.log("FIND DOCUMENTS OK")
           
           var count = 0;
           // loenda kõik leitud elemendid (peaks olema 1 või 0)
           cursor.each(function(error, doc) {
               tools.log(arguments)
               if(error){
                   tools.log("FETCH ERROR")
                   tools.log(error);
                   return callback(error, null);
               }
               
               tools.log(count)
               if(count>0){ 
                   return; // tagastab ainult esimese
               }
               
               tools.log(doc)
               
               if(doc){
                   tools.log("DOC OK")
                   callback(null, doc.data);
               }else{// elementide loendamine on lõppenud
                   if(!count){
                       tools.log("NO SUCH ITEM")
                       return callback(null, null);
                   }
               }
               count++;
           });
        });
            
    });
}

/**
 * normalizeDataObject([data]) -> Object
 * - data (Object): andmeobjekt
 * 
 * Vormindab objekti, kontrollides et kõik nõutud väljad oleks
 * olemas. Uuendab ka telefoninumbreid, et need oleks korrektsed
 * Tagastab modifitseeritud/lisatud objekti
 **/
exports.normalizeDataObject = function(data){
    if(!data)data = {};
    if(!data.org)data.org = {};
    if(!data.org.office)data.org.office = [];
    if(!data.org._gencount)data.org._gencount = 0;

    var initialize = function(office){
        if(!office.contacts)office.contacts = [];
        if(!office.links)office.links = [];
        if(!office.address)office.address = {};
        
        // igal esindusel oma ID, mille järgi saab tuvastada lisatud/eemaldatud
        if(office != data.org && !office._office){
            office._office = ++data.org._gencount;
        }

        for(var i=0; i<office.contacts.length; i++){
            if(office.contacts[i].type=="phone")
                office.contacts[i].value = tools.formatPhoneNr(office.contacts[i].value);
            if(office.contacts[i].type=="email")
                office.contacts[i].type="mailto";
        }
    }
    
    initialize(data.org);
    for(var i=0; i<data.org.office.length; i++){
        initialize(data.org.office[i]);
    }
    
    return data;
}


/**
 * validateDataObject(data) -> Array|Boolean
 * - data (Object): andmeobjekt
 * 
 * Kontrollib kas vajalikud väljad on seatud. Tagastab massiivi veateadetega
 * või false kui vigu polnud
 **/
exports.validateDataObject = function(data){
    var messages = [];

    if(!data.org.regcode)
        messages.push("Registrikood määramata");
    
    var checkOffice = function(office, main, i){
        var name = main?"Asutuse":"Esinduse nr "+i;
        
        if(!office.name)
            messages.push(name + " nimi määramata");
        
        if(!office.address)
            messages.push(name + " aadress määramata");
    }
    
    checkOffice(data.org, true);
    for(var i=0; i<data.org.office.length; i++){
        checkOffice(data.org.office[i], false, i);
    }
    
    return messages.length?messages:false;
}


function findBizinfoDiff(old_object, new_object){
    var old_keys = Object.keys
}


