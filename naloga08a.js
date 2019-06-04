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
    console.log("Aktiviramo pin 7");
    board.pinMode(7, board.MODES.INPUT);
    console.log("Aktiviramo pin 8");
    board.pinMode(8, board.MODES.INPUT); // pin za HW gumb
    console.log("aktiviramo pin 12 in 13");
    board.pinMode(12, board.MODES.OUTPUT);
    board.pinMode(13, board.MODES.OUTPUT); //pin 13 je rdeča led
    
    
});

function handler(req, res) {
    fs.readFile(__dirname + "/naloga08a.html",
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

var KpE = 0; // množenje Kp x napaka
var KiIedt = 0; // množenje Ki x integral napake
var KdDe_dt = 0; // množenje Kd x diferencial napake i.e. Derror/dt

var kontrolniAlgoritemVključen = 0; // spremenljivka, ki določa ali je ctrl. alg. vključen
var intervalCtrl; // spremenljivka za setInterval v globalnem prostoru

var timeout = false;
var zadnjaPoslana = null;
var zadnjaVrednost = null;

zastavicaBeriAnalogniPinA0 = 1; //v golobalnem prostoru definiramo zastavico



console.log("Zagon sistema"); // izpis sporočila o zagonu

var pošljiVrednostPrekoVtičnika = function(){}; // spr. za pošiljanje sporočil
var pošljiStatičnoSporočiloPrekoVtičnika = function() {}; // funkcija za pošiljanje statičnega sporočila

var parametriPomnilnik; //za hranjenje vrednosti parametrov

board.on("ready", function(){
    console.log("Plošča pripravljena");

    board.analogRead(0, function(value){
        if(zastavicaBeriAnalogniPinA0 == 1) želenaVrednost = value; // neprekinjeno branje pina A0
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
    
    socket.on("pošljiPozicijo", function(pozicija) {
        zastavicaBeriAnalogniPinA0 = 0; // ne beremo več iz pina A0
                                        // vrednost dobimo iz vmesnika
        želenaVrednost = pozicija;      // GUI prevzame lekcijo
        socket.emit("pošljiŽelenoVrednost", pozicija);
    });
        
    }); // konec socket.on("connection")
    
board.digitalRead(7, function(value) { // digitalno branje se dogodi večkrat, ob spremembi stanja iz 0->1 ali 1->0
    if (timeout !== false) { // če se je timeout spodaj pričel, (ob nestabilnem vhodu, npr. 0 1 0 1) ga biršemo
	   clearTimeout(timeout); // brišemo timeout dokler ni digitalni vhod stabilen, i.e. timeout = false
	   console.log("Timeout je postavljen na false");
    }
    timeout = setTimeout(function() { // ta del kode se bo izvedel po 50 ms; če se vmes dogodi sprememba stanja, ga gornja koda izbriše
    // zgornja vrstica pomeni timeout = true
        console.log("Timeout je postavljen na true");
        timeout = false;
        if (zadnjaVrednost != zadnjaPoslana) { // to send only on value change
            if (value == 1) {
               
               startKontrolniAlgoritem(parametriPomnilnik);
               
            }

        }

        zadnjaPoslana = zadnjaVrednost;
    }, 50); // izvedemo po 50ms
                
    zadnjaVrednost = value; // ta vrednost se prebere iz nožice 2 večkrat na s
    
}); // konec "board.digitalRead"
 
}); // konec board.on("ready")

function kontrolniAlgoritem (parametri) {
    parametriPomnilnik = parametri;
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
        // za pošliljanje na stran klienta
        KpE=parametri.Kp1*err;
        KiIedt=parametri.Ki1*errVsota;
        KdDe_dt=parametri.Kd1*dErr;
        pwm = KpE + KiIedt + KdDe_dt; // uporabimo gornje izraze
        zadnjiErr = err; // shranimo vrednost za naslednji cikel za oceno odvoda
    
        if (pwm > 255) {pwm = 255}; // omejimo vrednost pwm na 255
        if (pwm < -255) {pwm = -255}; // omejimo vrednost pwm na -255
        if (pwm > 0) {board.digitalWrite(2,0)}; // določimo smer če je > 0
        if (pwm < 0) {board.digitalWrite(2,1)}; // določimo smer če je < 0
        board.analogWrite(3, Math.abs(pwm)); // zapišemo abs vrednost na pin 3
    
        if (dejanskaVrednost < 200 || dejanskaVrednost > 850) {
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
        // če je alg. ustavljen, prižgemo redčo svetlećo diodo
        board.digitalWrite(13, board.LOW); //na pin LED ugasnemo
        board.digitalWrite(12, board.HIGH); //na pin LED prižgemp
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
    
    // če je alg. ustavljen, prižgemo redčo svetlećo diodo
    board.digitalWrite(13, board.HIGH); //na pin 13 pripeljemo +5V
    board.digitalWrite(12, board.LOW); //na pin 12 pripeljemo 0v
};

function pošljiVrednosti(socket) {
    socket.emit("klientBeriVrednosti",
    {
        "želenaVrednost": želenaVrednost,
        "dejanskaVrednost": dejanskaVrednost,
        "pwm": pwm,
        "err": err,
        "errVsota": errVsota,
        "dErr": dErr,
        "KpE": KpE,
        "KiIedt": KiIedt,
        "KdDe_dt": KdDe_dt
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