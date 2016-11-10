
//========INJECTOR TEST============
const injector = require('./html-injector');
const fs = require('fs');
const Buffer = require('buffer');

//Supported selector modifiers: '[attrName='value']' , #id, .class
//Supported methods: prepend, append, replaceWith, after, before, attr, html. 
//All these methods can take a string or a readable stream object

var readSt = fs.createReadStream(__dirname + '/input2.html', {encoding: 'utf-8'});
var newRes = injector();
var $ = newRes.$;

$("script[src='http://www.source.com/file.js']");
$("p#someId");
$("html");
$("meta");
$("link[href='css/color.min.css']");
$("ul#background").append().after("dothis");
$("ul.background").before("INSERTING THIS!!!");
//$("div.drop-overlay").before("INSERTING THI!");

newRes.on('error', console.log);
readSt.pipe(newRes).pipe(process.stdout);


/*
//=======SELECTOR TEST============
const selector = require('./selector')();
var $ = selector.$;

$("script[src='http://www.source.com/file.js']").append();
$("p#id1[attribute='newat']");
$('div.class3').append();
$('div#someid');
$('img').append();

selector.match('<script src="http://www.source.com/file.js" some="fda">');
selector.match('<p id="id1" attribute="newat">');
selector.match('<img>');
*/