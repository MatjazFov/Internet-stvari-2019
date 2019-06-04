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
    var operator1 = parseInt(deli[1],10); // 10 številski sistem
    var operator2 = parseInt(deli[2],10); // 10 številski sistem
    
    if (operator1 == 0) {
        board.digitalWrite(13, board.LOW);
    }
    if (operator1 == 1) {
        board.digitalWrite(13, board.HIGH);
    }
     if (operator2 == 0) {
        board.digitalWrite(8, board.LOW);
    }
    if (operator2 == 1) {
        board.digitalWrite(8, board.HIGH);
    }
    
    res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
    res.write("Za test vpišite v brskalnikovo vrstico z naslovom http://192.168.1.223:8080/1/1 <br> ");
    res.write("ali: http://192.168.1.223:8080/0/0 oz. /0/0, /0/1/, /1/0, /1/1");
    res.write("<Br> Vtednost vnešenega operatorja1 =" + operator1);
    res.write("<Br> Vtednost vnešenega operatorja2 =" + operator2);
}).listen(8080, "192.168.1.223");

