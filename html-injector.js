"use strict";

const stream = require('stream'),
      Buffer = require('buffer').Buffer,
      util = require('util'),
      selector = require('./selector');

module.exports = Injector;

function Injector(options) {
    if(!(this instanceof Injector)) {
        return new Injector(options);
    }
    
    stream.Transform.call(this);
    
    this.selector = selector();
    this.$ = selector.$.bind(this.selector); //TODO find another solution to this uglyness
    
    this.alreadyDone = false;   //writecb in _transform has already been called
    this.insideScript = false;  //is currently inside a script element '<script>....</script>'
    
    this.chunkBuffer = null;
    
    this.closingStack = {};
    this.insertAt = 0;         //used in pushToChunk function
    
    this.HtmlselfClosingTags = ['area', 'base', 'br', 'col' , 'command',
                                'embed', 'hr', 'img', 'input', 'keygen', 'link',
                                'meta', 'param', 'source', 'track', 'wbr'];
    
};

util.inherits(Injector, stream.Transform);

Injector.prototype._transform = function(chunk, encoding, done) {
    console.log("TYPE!!: ", Buffer.isBuffer(chunk));
    // Concatenate new chunk to internal buffer and free internal chunk buffer
    if(this.chunkBuffer) {
        chunk = Buffer.concat([this.chunkBuffer, chunk]);
        this.chunkBuffer = null;
    }
    
    // Flags for loop
    var insideOpening = false,      //is currently inside an opening tag '<...'
        insideClosing = false,      //is currently inside a closing tag '</...'
        insideQuotes = false;       //is currently inside quotes " or '
    
    var quoteChar,          //current quote character, ' or "
        curElement,         //current element being processed '<p class="someclass"> or </div>'
        lastOpenTagChar,    //index of last open tag character '<'.
        i = -1;
    
    
    var parse = function(startFrom) {
        i = startFrom || i;
        
        while(++i < chunk.length) {
            var char = String.fromCharCode(chunk[i]);

            if(insideOpening) {
                curElement += char;

                if(char === '\'' || char === '"') { //quote start or end 
                    if(insideQuotes) { //quote end
                        insideQuotes = (char === quoteChar) ? false : true;
                    }
                    else { //quote start
                        quoteChar = char;
                        insideQuotes = true;
                    }
                }

                else if(char === '>' && !insideQuotes) { //end of element
                    insideOpening = false;

                    if(curElement.slice(0, 7) === '<script')
                        this.insideScript = true;
                    
                    this.processElement(curElement, chunk, lastOpenTagChar, i, parse);
                    break;
                }
            }

            else if(insideClosing) {
                curElement += char;

                if(this.insideScript && curElement.length > 12) {
                    insideClosing = false;
                    continue;
                }

                if(char === '>') {//end of closing tag 
                    insideClosing = false;

                    if(curElement === '</script>')
                        this.insideScript = false;

                    this.processClosing(curElement, chunk, lastOpenTagChar, i, parse);
                    break;
                }
            }

            // Opening or closing tag
            else if(char === '<') {            
                curElement = '<';
                lastOpenTagChar = i;

                if(String.fromCharCode(chunk[i+1]) === '/') { //closing tag '</'
                    curElement += '/';
                    insideClosing = true;
                    i++;
                }
                else { //opening tag '<'
                    if(!this.insideScript) insideOpening = true;
                }
            }

        }

        // End parsing
        if(i >= chunk.length && !this.alreadyDone) {
            console.log(chunk);
            this.alreadyDone = true;
        
            // Incomplete opening '<...' or closing '</...' tag.
            // Push chunk up to incomplete tag beginning and save the rest in internal buffer.
            if(insideClosing || insideOpening) { 
                chunkBuffer = chunk.slice(lastOpenTagChar);
                this.push(chunk.slice(0, lastOpenTagChar));
            }

            else 
                this.push(chunk);

            done();
        }
        
    }.bind(this);
    
    
    parse();
};


Injector.prototype.processElement = function(tag, chunk, startTag, endTag, cb) {
    var tagName = tag.slice(1, tag.indexOf(' '));
    var matches = this.selector.match(tag);
    
    //No match
    if(matches.length === 0) {
        var stack = this.closingStack[tagName];
        
        if(stack && (this.HtmlselfClosingTags.indexOf(tagName) !== -1))
            stack[stack.length - 1].counter++;
        
        return cb();
    }
    
    var onCloseActions = [];
    
    //For each selector match
    matches.forEach( (match) => {
        if(!match.actions) {
            return cb();
        }
        
        //For each method called on the selector
        match.actions.forEach( (action) => {
            
            if( action.onClose && (this.HtmlselfClosingTags.indexOf(tagName) !== -1) )   //wait for closing tag
                onCloseActions.push(action);
            
            else 
                action.do(action.source, tag, pushToChunk.bind(this, chunk, startTag, endTag, cb));
            
            
            
        });
    });
    
    if(onCloseActions.length) {
        if(!this.closingStack[tagName])
            this.closingStack[tagName] = [];
        
        this.closingStack[tagName].push({
            actions: onCloseActions,
            counter: 1
        });
    }
    
};


Injector.prototype.processClosing = function(tag, chunk, startTag, endTag, cb) {
    var tagName = tag.slice(2,-1);
    
    var stack = this.closingStack[tagName];
    if(!stack) {
        return cb();
    }

    if ( (--(stack[stack.length - 1].counter)) === 0) {
        var actions = stack.pop().actions;
        
        actions.forEach( (action) => {
            action.do(action.source, tag, pushToChunk.bind(this, chunk, startTag, endTag, cb));
        });
        
        if(stack.length === 1)
            delete this.closingStack[tagName];
    }
    
};


Injector.prototype.$ = function(selector) {
    this.selector.$();
};

//Removes current tag from chunk once.TODO
//Inserts data in chunk at the position of the current tag.
//If there are no arguments, call callback with the new read position (i) as argument
function pushToChunk(chunk, startTag, endTag, cb, data) {
    var beginAt;
    
    //First time this function is called for this chunk
    if(this.insertAt === 0) {
        this.insertAt = startTag; 
        beginAt = endTag+1; 
    }
    else
        beginAt = this.insertAt;
        
    if(!data) {
        cb(this.insertAt);
        return;
    }
    
    if(typeof data === "string")
        data = Buffer.from(data);
    
    //else if(data is a stream) {
        
    //}
    
    else if(!Buffer.isBuffer(data)) 
        return false;
    
    chunk = Buffer.concat([chunk.slice(0, this.insertAt), data, chunk.slice(beginAt)]);
    this.insertAt += data.length; 
    
}