var http = require("http").createServer(handler); // "on req" - "handler"
var io = require("socket.io").listen(http); // socket knjižnica
var fs = require("fs"); // spremenljivka za "file system" za posredovanje html
var firmata = require("firmata");

console.log("Starting the code");

var prižgana = 0;

var board = new firmata.Board("/dev/ttyACM0", function(){
    console.log("Priklop na Arduino");
    console.log("Omogočimo Pin 0");
    board.pinMode(0, board.MODES.ANALOG); // analogna nožica 0
    board.pinMode(13, board.MODES.OUTPUT); 
});

function handler(req, res) {
    fs.readFile(__dirname + "/naloga10b.html",
    function (err, data) {
        if (err) {
            res.writeHead(500, {"Content-Type": "text/plain"});
            return res.end("Napaka pri nalaganju strani.");
        }
    res.writeHead(200);
    res.end(data);
    })
}

var želenaVrednost = 0; // želena vrednost nastavljena s pot.

http.listen(8080); // strežnik bo poslušal na vratih 8080

board.on("ready", function() {
    
    board.analogRead(2, function(value){
        želenaVrednost = value; // zvezno branje analogne nožice 0
    });
    
    io.sockets.on("connection", function(socket) {
        socket.emit("messageToClient", "Strežnik priključen, plošča pripravljena.");
        setInterval(sendValues, 40, socket); // na 40ms pošljemo sporočilo klientu
        socket.on("ukazArduinu", function(štUkaza) {
        if (štUkaza == "1") {
            board.digitalWrite(13, board.HIGH); // zapišemo +5V na p. 13
            prižgana = 1;
        }
        if (štUkaza == "0") {
            board.digitalWrite(13, board.LOW); // zapišemo 0V na pin13
            prižgana = 0;
        }
        
    });
    }); // konec "sockets.on connection"

}); // konec "board.on(ready)""

function sendValues (socket) {
    socket.emit("klientBeriVrednosti",
    {
    "želenaVrednost": želenaVrednost
    });
    if (želenaVrednost > 860 && prižgana ==1){
         io.sockets.emit("pošljiStatičnoSporočiloKlientu", "LED prižgana");
    }
    if (želenaVrednost <= 860 && prižgana ==1){
         io.sockets.emit("pošljiStatičnoSporočiloKlientu", "NAPAKA - gumb pritisnjen, LED ne gori");
    }
    if (želenaVrednost < 860 && prižgana ==0){
         io.sockets.emit("pošljiStatičnoSporočiloKlientu", "LED ugasnjena");
    }
    if (želenaVrednost >= 860 && prižgana ==0){
         io.sockets.emit("pošljiStatičnoSporočiloKlientu", "NAPAKA - pritisnjen gumb ugasni, LED kljub temu sveti");
    }
};
