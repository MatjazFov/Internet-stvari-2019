var http = require("http"); // knjižnica za http strežnik
var firmata = require("firmata"); // za intereakcijo z Arduinom

// ACM (Abstract Control Mode) za serijsko komunikacijo z Ardiuinom
var board = new firmata.Board("/dev/ttyACM0", function(){
    board.pinMode(13, board.MODES.OUTPUT);// Nožica oz. pin 13 -> digitalni izhod
    board.pinMode(8, board.MODES.OUTPUT);// Nožica oz. pin 8 -> digitalni izhod
    
})

console.log("Zagon nodejs strežnika.");

http.createServer(function(req, res){
    var deli = req.url.split("/"); // razdelimo url glede na znak "/"
    var operator = parseInt(deli[1], 10); // 10 številski sistem
    
    if (operator == 0) {
        board.digitalWrite(13, board.LOW);
    }
    if (operator == 1) {
        board.digitalWrite(13, board.HIGH);
    }
     if (operator == 2) {
        board.digitalWrite(8, board.LOW);
    }
    if (operator == 3) {
        board.digitalWrite(8, board.HIGH);
    }
    
    res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
    res.write("Pozdravljen svet! ");
    res.end("Vrednost vnešenega operatoratorja = " + operator);
}).listen(8080, "192.168.1.223");

