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
    
    stream.Transform.call(this, options);
    
    this.selector = selector();
    this.$ = selector.$.bind(this.selector); //TODO find another solution to this uglyness
    
    //Flags for parse()
    this.alreadyDone = false;   //writecb in _transform has already been called
    this.insideScript = false;  //is currently inside a script element '<script>....</script>'
    
    //Used in parse()
    this.chunkBuffer = null;
    this.curChunk = null;
    this.offset = 0;
    
    this.closingStack = {};
    
    this.HtmlselfClosingTags = ['area', 'base', 'br', 'col' , 'command',
                                'embed', 'hr', 'img', 'input', 'keygen', 'link',
                                'meta', 'param', 'source', 'track', 'wbr'];
    
    //Flags for pushToChunk()
    this.dataStart = null;
    this.tagStart = null;
    this.tagLen = null;
    this.firstPush = null;
    
};

util.inherits(Injector, stream.Transform);

Injector.prototype._transform = function(chunk, encoding, done) {

    // Concatenate new chunk to internal buffer and free internal chunk buffer
    if(this.chunkBuffer) {
        chunk = Buffer.concat([this.chunkBuffer, chunk]);
        this.chunkBuffer = null;
    }
    
    this.curChunk = chunk; 
    
    // Flags for loop
    var insideOpening = false,      //is currently inside an opening tag '<...'
        insideClosing = false,      //is currently inside a closing tag '</...'
        insideQuotes = false;       //is currently inside quotes " or '
    
    var quoteChar,          //current quote character, ' or "
        curElement,         //current element being processed '<p class="someclass"> or </div>'
        lastOpenTagChar,    //index of last open tag character '<'.
        i = -1;
    
    //TODO performance: move this definition out of _transform so it wont unecessarily have closure over chunk
    var parse = function() {
        i += this.offset;
      
        while(++i < this.curChunk.length) {
            var char = String.fromCharCode(this.curChunk[i]);

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
                    
                    this.processElement(curElement, lastOpenTagChar, i, parse);
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

                    this.processClosing(curElement, lastOpenTagChar, i, parse);
                    break;
                }
            }

            // Opening or closing tag
            else if(char === '<') {            
                curElement = '<';
                lastOpenTagChar = i;

                if(String.fromCharCode(this.curChunk[i+1]) === '/') { //closing tag '</'
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
        if(i >= this.curChunk.length && !this.alreadyDone) {
            this.alreadyDone = true;
        
            // Incomplete opening '<...' or closing '</...' tag.
            // Push chunk up to incomplete tag beginning and save the rest in internal buffer.
            if(insideClosing || insideOpening) { 
                chunkBuffer = this.curChunk.slice(lastOpenTagChar);
                this.push(this.curChunk.slice(0, lastOpenTagChar));
            }

            else 
                this.push(this.curChunk);

            done();
        }
        
    }.bind(this);
    
    
    parse();
};


Injector.prototype.processElement = function(tag, startTag, endTag, doneCb) {
    var tagName = tag.slice(1, tag.indexOf(' '));
    var matches = this.selector.match(tag);
    
    this.offset = 0;
    
    //No matches
    if(matches.length === 0) {
        var stack = this.closingStack[tagName];
        
        if(stack && (this.HtmlselfClosingTags.indexOf(tagName) === -1)) 
            stack[stack.length - 1].counter++;
        
        return doneCb();
    }

    var onCloseActions = [];
    var actionIndex = 0;
    var match;
    
    //Used in pushToChunk
    this.tagStart = this.dataStart = startTag;
    this.tagLen = tag.length;
    
    //Iterate through matches
    var nextMatch = function() {
        match = matches.shift();
       
        if(!match) {
            if(onCloseActions.length) {
                if(!this.closingStack[tagName])
                    this.closingStack[tagName] = [];
        
                this.closingStack[tagName].push({
                    actions: onCloseActions,
                    counter: 1
                });
        
            }
            doneCb();
        }
        
        else if(!(match.actions && match.actions.length))
            nextMatch();
        
        else {
            actionIndex = 0;
            nextAction();
        }
        
    }.bind(this);
    
    //Iterate through actions
    var nextAction = function() {
        //var action = match.actions.shift();
        var action = match.actions[actionIndex++];
    
        if(!action)
            nextMatch();
        
        else if( action.onClose && (this.HtmlselfClosingTags.indexOf(tagName) === -1) ) {  //wait for closing tag
            
            onCloseActions.push(action);
            nextAction();
        }
        
        else {
            this.firstPush = true;
            action.do(action.source, tag, pushToChunk.bind(this, nextAction));
        }
    }.bind(this);
    
    nextMatch();
    
};


Injector.prototype.processClosing = function(tag, startTag, endTag, doneCb) {
    var tagName = tag.slice(2,-1);
    
    this.offset = 0;
    var stack = this.closingStack[tagName];
   
    if(!(stack && stack.length)) {
        return doneCb();
    }
    
    //Used in pushToChunk
    this.tagStart = this.dataStart = startTag;
    this.tagLen = tag.length;
    
    var actionIndex = 0;
    var actions;
    
    var nextAction = function() {
        var action = actions[actionIndex++];
        
        if(!action) {
            if(stack.length === 0)
                delete this.closingStack[tagName];  //not working?
            doneCb();
        }
        
        else {
            this.firstPush = true;
            action.do(action.source, tag, pushToChunk.bind(this, nextAction));
        }
            
    }.bind(this);
    
    if ( (--(stack[stack.length - 1].counter)) === 0) {
        actions = stack.pop().actions;
        nextAction();
    }
    
    else
        doneCb();
    
};


Injector.prototype.$ = function(selector) {
    this.selector.$();
};

//Removes current tag from chunk once.
//Inserts data in chunk at the position of the current tag.
function pushToChunk(doneCb, data, isTag) {  
    if(this.firstPush) {
        this.dataStart = this.tagStart;
        //Remove tags
        this.curChunk = Buffer.concat([this.curChunk.slice(0, this.tagStart), this.curChunk.slice(this.tagStart + this.tagLen)]);
        this.firstPush = false;
    }
    
    if(!data) {
        return doneCb();
    }
    
    if(isTag) {
        this.tagStart = this.dataStart;
        this.tagLen = data.length;
    }
    
    else
       this.offset += data.length; 
    
    if(typeof data === "string")
        data = Buffer.from(data);
    
    this.curChunk = Buffer.concat([this.curChunk.slice(0, this.dataStart), data, this.curChunk.slice(this.dataStart)]);
    
    this.dataStart += data.length;
   
}
