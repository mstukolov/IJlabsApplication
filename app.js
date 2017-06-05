var cfenv = require("cfenv");
require('dotenv').load();
var config = require('./config.json');

//email dependencies
//const nodemailer = require('nodemailer');

//Инициализация веб-сервера и основных настроек
var express = require("express");
var app = express();
app.use(express.static(__dirname + '/public'));
var options = {
    root: __dirname + '/public/',
    dotfiles: 'deny',
    headers: {
        'x-timestamp': Date.now(),
        'x-sent': true
    }
};
//Инициализация IOT-сервиса
var iotfService = require("ibmiotf");
var appClientConfig = {
    "org" : 'kwxqcy',
    "id" : 'a-kwxqcy-app5',
    "domain": "internetofthings.ibmcloud.com",
    "auth-key" : 'a-kwxqcy-1dw7hvzvwk',
    "auth-token" : 'tsM8N(FS@iOc3CId+5'
}
var appClient = new iotfService.IotfApplication(appClientConfig);
appClient.connect();
appClient.on("connect", function () {
    appClient.subscribeToDeviceEvents("SmartCooler","C2MSmartCooler2","+","json");
});
var lastdata = [];
var set = new Set();

appClient.on("deviceEvent", function (deviceType, deviceId, eventType, format, payload) {
    /*if(lastdata.length > 4){
        lastdata.shift()
        var lastVal = findLastMessageByDeviceId("ESP8266-2229160");
        if(lastVal != undefined){
            console.log('Last value: ' + lastVal['d']['param1'])
        }else {console.log('Last value: NULL')}
    }*/
        if(lastdata.length > 96){
            lastdata.shift()
        }
        console.log("Device Event from :: "+deviceType+" : "+deviceId+" of event "+eventType+" with payload : "+payload);
        addLastValToStack(JSON.parse(payload))
        console.log('Total messagess: ' + lastdata.length)

});
function addLastValToStack(message) {
    for (var i = 0; i < lastdata.length; i++) {
        var current = lastdata[i];
        if(current['d']['deviceid'] == message['d']['deviceid']) lastdata.splice(i,1)
    }
    //if(message['d']['param1'] < 2){sendAlertToEmail(); console.log('Current value is lower than 2')}
    lastdata.push(message)
}
function findLastMessageByDeviceId(deviceid) {
    var reverse = lastdata.reverse();
    var lastVal = reverse.find(function (element, index, array) {
        return element['d']['deviceid'] == deviceid
    })
    return lastVal;
}
/*
var gatewayClient = new iotf.IotfGateway(configType);
gatewayClient.log.setLevel('debug');
gatewayClient.connect();
*/
//----Инициализация подключения к MySQL
var mysql = require('mysql');
var db = mysql.createConnection({
    host: 'sl-us-dal-9-portal.3.dblayer.com',
    port: '19904',
    user: 'admin',
    password: 'OOYHORSHUNYPKLAF',
    database: 'compose'
});
createTable();
//-------------Основной исполняемый код----------------------------
app.get('/', function (req, res) {
    var fileName = "index.html";
    res.sendFile(fileName, options);
});
app.get('/testdeviceconnection', function (req, res) {
    console.log('testdeviceconnection: ' + req.query.devtype + ':' + req.query.devid);
    appClient.connect();
    appClient.on('connect', function () {
        console.log('Success device connection');
        res.send('Success device connection from Node.js');
    });
});
app.get("/savedevice", function(req, res) {
    //gatewayClient.publishDeviceEvent(req.query.devtype, req.query.devid, "status","json",'{"d" : { "cpu" : 60, "mem" : 50 }}');

    var devices = {
        "devices" : [
            {
                "typeId": req.query.devtype,
                "deviceId": req.query.devid
            }
        ]
    };
    /*var devices2 =
    // Register Multiple devices
    appClient.registerMultipleDevices(devices.devices). then (
        function onSuccess (response) {
            //Success callback
            console.log("Success");
            console.log(response);
        },
        function onError (argument) {
            //Failure callback
            console.log("Fail");
            console.log(argument);
        });*/
    saveDeviceToMySql(req.query.orgid, req.query.devid, req.query.devtype);
    res.redirect("devices.html")
});
app.get('/getcurvalues', function(req, res){

    var deviceList = req.query.devices
    var newValues = []
   /* console.log(req.query.type)
    console.log(deviceList)*/
   if(typeof deviceList !== "undefined"){
       deviceList.forEach(function(item, i, arr) {
           var point = {};
           var last = findLastMessageByDeviceId(item)
           if(last != undefined){
               var currentValue = last['d']['param1'];
               var maxValue = last['d']['param2'];

               if(maxValue == 0){maxValue = currentValue}
               if(maxValue != 0){
                   if(currentValue > maxValue) {maxValue = currentValue}
                   point['b'] = maxValue;
               } else { point['b'] = 1; }

           }else{
               currentValue = 0
           }

           point['y'] = item;
           point['a'] = currentValue;

           newValues.push(point)
       });
       res.send(newValues);
   } else {
       res.send('device list empty');
   }

    //console.log(newValues)


});
app.get("/deletedevice", function(req, res) {
    var deviceid = req.query.devid;
    var devicetype = req.query.devtype;
    var sql = 'DELETE FROM devices where devid = ?';

    /*appClient.
    unregisterDevice(devicetype, deviceid). then (function onSuccess (response) {
        //Success callback
        console.log("Success");
        console.log(response);
    }, function onError (argument) {
        //Failure callback
        console.log("Fail");
        console.log(argument);
    });*/
    db.query(sql, [deviceid], function (err, result) {
        if(err) throw err;
        res.send(result);
    });
    console.log('Device deleted: ' + deviceid);
});
app.get("/getOrgDevices", function(req, res) {

    var orgid = req.query.orgid;
    var sql = 'SELECT * FROM devices where orgid = ?';
    db.query(sql, [req.query.orgid], function (err, result) {
        if(err) throw err;
        res.send(result);
    });

});
app.get("/getOrgDevicesGPS", function(req, res) {
    var orgid = req.query.orgid;
    var sql = 'SELECT devid, lng, ltd FROM devices where orgid = ?';

    db.query(sql, [req.query.orgid], function (err, result) {
        if(err) throw err;
        res.send(result);
    });
});
app.get("/testQuery", function(req, res) {
    var network = req.query.wifi;
    var password = req.query.password;
    console.log('Запрос пришел: ' + network + ":" + password);
});

//работа с реле
//включение реле
app.get("/releon", function(req, res) {
    var on={"rel":1};
    on = JSON.stringify(on);
    appClient.publishDeviceCommand("SmartCooler","TestCooler-RT-71", "rele", "json", on);
    console.log('Реле успешно запущено');
});
app.get("/releoff", function(req, res) {
    var off={"rel":0};
    off = JSON.stringify(off);
    appClient.publishDeviceCommand("SmartCooler","TestCooler-RT-71", "rele", "json", off);
    console.log('Реле остановлено');
});


//-----------------------

//Код для запуска в локальном режиме

var appEnv = cfenv.getAppEnv();
var port = appEnv.port || 8080;

app.listen(port, function () {
    console.log("Express WebApp started on : http://localhost:" + port);
});


/*
var hostPort = 4444;
app.listen(hostPort, function () {
    console.log('Example app listening on port: ' + hostPort);
});
*/


//Код для публикации на Bluemix-сервере
/*var appEnv = cfenv.getAppEnv();
 app.listen(appEnv.port, '0.0.0.0', function () {
 console.log('Example app listening on port 3000!');
 });*/

//---CRUD operation for mysql db----
function createTable() {
    var sql = 'CREATE TABLE IF NOT EXISTS devices ('
        + 'id INTEGER PRIMARY KEY AUTO_INCREMENT,'
        + 'orgid text,'
        + 'devid text,'
        + 'devtype text'
        + ');';
    db.query(sql, function (err, result) {
        if (err) console.log(err);
    });
}
function saveDeviceToMySql(orgid, devid, devtype) {
    var sql = 'INSERT INTO devices SET ?';
    var newDevice = { orgid: orgid, devid: devid,  devtype: devtype};


    db.query(sql, [newDevice], function (err, result) {
        if(err) throw err;
        console.log('Last insert ID:', result.insertId);
    });
}
function getOrgDevices() {
    var sql = 'SELECT * FROM devices';
    var data = [];
    db.query(sql, function (err, result) {
        if(err) throw err;
        data=result;
    });
    return data;
}

/*
//Send email messages
function sendAlertToEmail() {
    // create reusable transporter object using the default SMTP transport
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'maxim.stukolov@gmail.com',
            pass: 'carter2014!'
        }
    });
// setup email data with unicode symbols
    var mailOptions = {
        from: '"SmartCooler-C2M 👻" <foo@blurdybloop.com>', // sender address
        to: 'maks@center2m.com', // list of receivers
        subject: 'Smart cooler alerts ✔', // Subject line
        text: 'The Volume of smart cooler is lower. please change the bottle!', // plain text body
        html: '<b>The Volume of smart cooler is lower. please change the bottle!</b>' // html body
    };
// send mail with defined transport object
    transporter.sendMail(mailOptions);
}
*/
