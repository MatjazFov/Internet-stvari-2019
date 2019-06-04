var http = require("http").createServer(handler); // ob zahtevi req -> handler
var firmata = require("firmata");
var fs = require("fs"); // knjižnjica za delo z datotekami (File System fs)
var io = require("socket.io").listen(http); // knjiž. za komunik. prek socket-a 

console.log("Priklop Arduina");

var board = new firmata.Board("/dev/ttyACM0", function(){
    console.log("Aktiviramo pin 2");
    board.pinMode(2, board.MODES.OUTPUT); // pin za smer na H-mostu
    console.log("Omogočimo Pin 0");
    board.pinMode(0, board.MODES.ANALOG); // analogna nožica 0
    console.log("Aktiviramo pin 3");
    board.pinMode(11, board.MODES.SERVO) // Pulse Width Modulation - hitrost
});

function handler(req, res) {
    fs.readFile(__dirname + "/naloga12.html", //
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

console.log("Zagon sistema"); // izpis sporočila o zagonu

board.on("ready", function(){
    console.log("Plošča pripravljena");
    board.analogRead(0, function(value){
        želenaVrednost = value; // neprekinjeno branje pina A0
    });
    
    io.sockets.on("connection", function(socket){
        setInterval(sendValues, 40, socket); // na 40ms pošljemo sporočilo klientus
        socket.on("pošljiPWM", function(SERVO){
            board.servoWrite(11,SERVO); // zapišem hitrost SERVO na pin 11
            console.log("SERVO poslan." + SERVO);
        });
        
        socket.on("levo", function(vrednost) {
            board.digitalWrite(2,vrednost);
        });
        
        socket.on("desno", function(vrednost) {
            board.digitalWrite(2,vrednost);
        });
        
        socket.on("stop", function(vrednost) {
            board.analogWrite(3,vrednost);
        });

    });
function sendValues (socket) {
    board.servoWrite(11,(želenaVrednost /1023) * 180);
    socket.emit("klientBeriVrednosti",
    {
    "želenaVrednost": želenaVrednost
    });
};
    
}); // konec board.on("ready")