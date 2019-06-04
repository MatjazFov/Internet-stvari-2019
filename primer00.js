var http = require("http"); // knjižnica za http strežnik

console.log("Zagon nodejs strežnika.");

http.createServer(function(req, res){
    var deli = req.url.split("/"); // razdelimo url glede na znak "/"
    var operator = parseInt(deli[1], 10); // 10 številski sistem
    res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
    res.write("Pozdravljen svet! ");
    res.end("Vrednost vnešenega operatoratorja = " + operator);
}).listen(8080, "192.168.1.223");

