var http = require("http").createServer(handler); // ob zahtevi req -> handler
var firmata = require("firmata");
var fs = require("fs"); // knjižnjica za delo z datotekami (File System fs)
var io = require("socket.io").listen(http); // knjiž. za komunik. prek socket-a 

console.log("Priklop Arduina");

var board = new firmata.Board("/dev/ttyACM0", function(){
    console.log("Aktiviramo analogni pin 0");
    board.pinMode(0, board.MODES.ANALOG);
    console.log("Aktiviramo analogni pin 1");
    board.pinMode(1, board.MODES.ANALOG);
    console.log("Aktiviramo pin 2");
    board.pinMode(2, board.MODES.OUTPUT); // pin za smer na H-mostu
    console.log("Aktiviramo pin 3");
    board.pinMode(3, board.MODES.PWM); // Pulse Width Modulation - hitrost
    console.log("Aktiviramo pin 8");
    board.pinMode(8, board.MODES.INPUT); // pin za HW gumb
});

function handler(req, res) {
    fs.readFile(__dirname + "/primer17.html",
    function(err, data) {
        if (err) {
            res.writeHead(500, {"Content-Type": "text/plain"});
            return res.end("Napaka pri nalaganju html strani!");
        }
        res.writeHead(200);
        res.end(data);
    });
}

http.listen(8080); // strežnik bo poslušal na vratih 8080

var želenaVrednost = 0; // želeno vrednost postavimo na 0
var dejanskaVrednost = 0; // dejansko vrednost postavimo na 0
var faktor =0.4; // faktor, ki določa hitrost doseganja želenega stanja
var pwm = 0;

// Spremenljivke PID algoritma
var Kp = 0.8; // proporcionalni faktor
var Ki = 0.008; // integralni faktor
var Kd = 0.15; // diferencialni faktor

var err = 0; // error
var errVsota = 0; // vsota napak
var dErr = 0; // diferenca napak
var zadnjiErr = 0; // da obdržimo vrednost prejšnje napake



var kontrolniAlgoritemVključen = 0; // spremenljivka, ki določa ali je ctrl. alg. vključen
var intervalCtrl; // spremenljivka za setInterval v globalnem prostoru

console.log("Zagon sistema"); // izpis sporočila o zagonu

var pošljiVrednostPrekoVtičnika = function(){}; // spr. za pošiljanje sporočil
var pošljiStatičnoSporočiloPrekoVtičnika = function() {}; // funkcija za pošiljanje statičnega sporočila

board.on("ready", function(){
    console.log("Plošča pripravljena");

    board.analogRead(0, function(value){
        želenaVrednost = value; // neprekinjeno branje pina A0
    });
    board.analogRead(1, function(value){
        dejanskaVrednost = value; // neprekinjeno branje pina A1
    });
    
    //startKontrolniAlgoritem(); // poženemo kontrolni algoritem
    
    io.sockets.on("connection", function(socket){
        
        socket.emit("pošljiStatičnoSporočiloPrekoVtičnika", "Strežnik povezan, plošča pripravljena.")

        setInterval(pošljiVrednosti, 40, socket); // na 40ms pošlj. vred.
        
        socket.on("startKontrolniAlgoritem", function(štKontrolnegaAlg){
           startKontrolniAlgoritem(štKontrolnegaAlg); 
        });
        
        socket.on("stopKontrolniAlgoritem", function(){
           stopKontrolniAlgoritem(); 
        });   
        
    pošljiVrednostPrekoVtičnika = function (value) {
        io.sockets.emit("sporočiloKlientu", value);
    } 
    
    pošljiStatičnoSporočiloPrekoVtičnika = function (value) {
        io.sockets.emit("statičnoSporočiloKlientu", value);
    }
    
    
        
    }); // konec socket.on("connection")
 
}); // konec board.on("ready")

function kontrolniAlgoritem (parametri) {
    if (parametri.štKontrolnegaAlg == 1) {
        pwm = parametri.faktor*(želenaVrednost-dejanskaVrednost);
        if (pwm > 255) {pwm = 255}; // omejimo vrednost pwm na 255
        if (pwm < -255) {pwm = -255}; // omejimo vrednost pwm na -255
        if (pwm > 0) {board.digitalWrite(2,0)}; // določimo smer če je > 0
        if (pwm < 0) {board.digitalWrite(2,1)}; // določimo smer če je < 0
        board.analogWrite(3, Math.abs(pwm)); // zapišemo abs vrednost na pin 3
        if (dejanskaVrednost < 150 || dejanskaVrednost > 910) {
            stopKontrolniAlgoritem();
        }
    }
    if (parametri.štKontrolnegaAlg == 2) {
        err = želenaVrednost - dejanskaVrednost; // odstopanje ali error
        errVsota += err; // vsota napak (kot integral)
        dErr = err - zadnjiErr; // razlika odstopanj
        pwm = parametri.Kp1*err + parametri.Ki1*errVsota + parametri.Kd1*dErr; // izraz za PID kontroler (iz enačbe)
        zadnjiErr = err; // shranimo vrednost za naslednji cikel za oceno odvoda
    
        if (pwm > 255) {pwm = 255}; // omejimo vrednost pwm na 255
        if (pwm < -255) {pwm = -255}; // omejimo vrednost pwm na -255
        if (pwm > 0) {board.digitalWrite(2,0)}; // določimo smer če je > 0
        if (pwm < 0) {board.digitalWrite(2,1)}; // določimo smer če je < 0
        board.analogWrite(3, Math.abs(pwm)); // zapišemo abs vrednost na pin 3
    
        if (dejanskaVrednost < 150 || dejanskaVrednost > 850) {
            stopKontrolniAlgoritem();
        }
    }    

}

function startKontrolniAlgoritem (parametri) {
    if (kontrolniAlgoritemVključen == 0) {
        kontrolniAlgoritemVključen = 1;
        intervalCtrl = setInterval(function(){kontrolniAlgoritem(parametri);}, 30); // kličemo alg. na 30ms
        console.log("Vključen kontrolni algoritem št. " + parametri.štKontrolnegaAlg)
        pošljiStatičnoSporočiloPrekoVtičnika("Kontrolni algoritem št. " + parametri.štKontrolnegaAlg + " zagnan | " + json2txt(parametri));
    }
}

function stopKontrolniAlgoritem () {
    clearInterval(intervalCtrl); // brišemo interval klica kontrolnega algoritma
    board.analogWrite(3, 0);
    kontrolniAlgoritemVključen = 0;
    err = 0; // odstopanje ali error
    errVsota = 0; // vsota napak (kot integral)
    dErr = 0; // razlika odstopanj
    pwm = 0; // izraz za PID kontroler (iz enačbe)
    zadnjiErr = 0; // shranimo vrednost za naslednji cikel za oceno odvoda    
    
    console.log("Kontrolni algoritem zaustavljen.");
    pošljiStatičnoSporočiloPrekoVtičnika("Kontrolni algoritem zaustavljen.");
};

function pošljiVrednosti(socket) {
    socket.emit("klientBeriVrednosti",
    {
        "želenaVrednost": želenaVrednost,
        "dejanskaVrednost": dejanskaVrednost,
        "pwm": pwm,
        "err": err,
        "errVsota": errVsota,
        "dErr": dErr
    });
};

function json2txt(obj) // funkcija za izpis json imen in vrednosti
{
  var txt = '';
  var recurse = function(_obj) {
    if ('object' != typeof(_obj)) {
      txt += ' = ' + _obj + '\n';
    }
    else {
      for (var key in _obj) {
        if (_obj.hasOwnProperty(key)) {
          txt += '.' + key;
          recurse(_obj[key]);
        } 
      }
    }
  };
  recurse(obj);
  return txt;
}
